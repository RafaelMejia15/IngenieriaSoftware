from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from database import get_db
from deps import CurrentUser, require_admin, require_usuario_aspirante
from models import (
    CatalogoRequisito,
    Convocatoria,
    ConvocatoriaRequisito,
    Postulacion,
    PostulacionDocumento,
    Usuario,
)
from s3_storage import (
    ALLOWED_CONTENT_TYPES,
    delete_object,
    get_s3_bucket,
    get_upload_max_bytes,
    presigned_get_url,
    sanitize_filename,
    upload_fileobj,
    build_object_key,
)
from vacantes_router import _convocatoria_from_model
from vacantes_schemas import (
    AdminPostulacionDetalleResponse,
    AdminPostulacionesDeConvocatoriaResponse,
    AdminDocumentoDetalle,
    DocumentoSubidoResponse,
    AdminPostulacionListItem,
    MisPostulacionesItemResponse,
    MisPostulacionesListResponse,
    PostularResponse,
    PostulacionUsuarioResumen,
    RequisitoDocumentoEstado,
)


router = APIRouter(tags=["postulaciones"])


def _convocatoria_es_vigente(cv: Convocatoria) -> bool:
    now = datetime.now(timezone.utc)
    return (
        cv.estado == "ABIERTA"
        and cv.fecha_inicio <= now
        and cv.fecha_fin >= now
    )


def _requisito_permite_para_convocatoria(db: Session, id_cv: UUID, id_req: UUID) -> bool:
    return (
        db.scalar(
            select(ConvocatoriaRequisito).where(
                ConvocatoriaRequisito.id_convocatoria == id_cv,
                ConvocatoriaRequisito.id_requisito == id_req,
            )
        )
        is not None
    )


@router.post(
    "/aspirante/convocatorias/{id_convocatoria}/postular",
    response_model=PostularResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_postulacion(
    id_convocatoria: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_usuario_aspirante),
):
    cv = db.get(Convocatoria, id_convocatoria)
    if not cv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada")
    if not _convocatoria_es_vigente(cv):
        raise HTTPException(
            status_code=400,
            detail="La convocatoria no está abierta para postulaciones",
        )
    existe = db.scalar(
        select(Postulacion).where(
            Postulacion.id_convocatoria == id_convocatoria,
            Postulacion.id_usuario == user.id_usuario,
        )
    )
    if existe:
        raise HTTPException(status_code=409, detail="Ya postulaste a esta convocatoria")
    post = Postulacion(
        id_convocatoria=id_convocatoria,
        id_usuario=user.id_usuario,
        estado="RECIBIDA",
    )
    db.add(post)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Postulación duplicada")
    db.refresh(post)
    return PostularResponse(
        id_postulacion=post.id_postulacion,
        estado=post.estado,
        id_convocatoria=post.id_convocatoria,
    )


def _normalize_content_type(ct: str | None) -> str | None:
    if not ct:
        return None
    return ct.split(";")[0].strip().lower()


def _mis_item_from_postulacion(p: Postulacion) -> MisPostulacionesItemResponse:
    c = p.convocatoria
    by_req = {d.id_requisito: d for d in p.documentos}
    reqs: list[RequisitoDocumentoEstado] = []
    for cr in sorted(c.requisitos_vinculo, key=lambda x: x.requisito.codigo):
        r = cr.requisito
        doc = by_req.get(r.id_requisito)
        reqs.append(
            RequisitoDocumentoEstado(
                id_requisito=r.id_requisito,
                codigo=r.codigo,
                nombre=r.nombre,
                obligatorio=cr.obligatorio,
                documento_subido=doc is not None,
                nombre_archivo_subido=doc.nombre_original if doc else None,
                content_type_subido=doc.content_type if doc else None,
                subido_en=doc.subido_en if doc else None,
            )
        )
    total = len(reqs)
    completos = sum(1 for x in reqs if x.documento_subido)
    return MisPostulacionesItemResponse(
        id_postulacion=p.id_postulacion,
        estado=p.estado,
        creada_en=p.creada_en,
        convocatoria=_convocatoria_from_model(c),
        requisitos=reqs,
        documentos_completos=completos,
        documentos_total=total,
    )


@router.get(
    "/aspirante/mis-postulaciones",
    response_model=MisPostulacionesListResponse,
)
def mis_postulaciones(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_usuario_aspirante),
):
    posts = db.scalars(
        select(Postulacion)
        .where(Postulacion.id_usuario == user.id_usuario)
        .options(
            selectinload(Postulacion.convocatoria).selectinload(
                Convocatoria.requisitos_vinculo
            ).selectinload(ConvocatoriaRequisito.requisito),
            selectinload(Postulacion.documentos),
        )
        .order_by(Postulacion.creada_en.desc())
    ).all()
    return MisPostulacionesListResponse(
        items=[_mis_item_from_postulacion(p) for p in posts]
    )


@router.post(
    "/aspirante/postulaciones/{id_postulacion}/documentos",
    response_model=DocumentoSubidoResponse,
)
async def subir_documento_postulacion(
    id_postulacion: UUID,
    id_requisito: UUID = Form(..., description="Requisito de la vacante para este archivo"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_usuario_aspirante),
):
    bucket = ""
    try:
        bucket = get_s3_bucket()
    except ValueError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e),
        ) from e

    post = db.get(Postulacion, id_postulacion)
    if not post or post.id_usuario != user.id_usuario:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    cv = db.get(Convocatoria, post.id_convocatoria)
    if not cv or not _convocatoria_es_vigente(cv):
        raise HTTPException(
            status_code=400,
            detail="No puedes cargar archivos fuera del periodo de vigencia",
        )

    if not _requisito_permite_para_convocatoria(db, post.id_convocatoria, id_requisito):
        raise HTTPException(
            status_code=400,
            detail="Este requisito no aplica a la convocatoria",
        )

    body = await file.read()
    max_b = get_upload_max_bytes()
    if len(body) > max_b:
        raise HTTPException(status_code=400, detail=f"Archivo muy grande (máx {max_b} bytes)")

    ct = _normalize_content_type(file.content_type)
    if not ct or ct not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no permitido (use PDF o imágenes JPEG/PNG)",
        )

    fname = sanitize_filename(file.filename or "archivo.bin")
    key = build_object_key(post.id_postulacion, id_requisito, fname)

    existing = db.scalar(
        select(PostulacionDocumento).where(
            PostulacionDocumento.id_postulacion == post.id_postulacion,
            PostulacionDocumento.id_requisito == id_requisito,
        )
    )

    buf = BytesIO(body)
    try:
        upload_fileobj(bucket, key, buf, ct)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Error al guardar en S3") from exc

    if existing:
        delete_object(existing.s3_bucket, existing.s3_key)
        existing.s3_bucket = bucket
        existing.s3_key = key
        existing.nombre_original = fname
        existing.content_type = ct
        existing.tamano_bytes = len(body)
        existing.subido_en = datetime.now(timezone.utc)
        doc_row = existing
    else:
        doc_row = PostulacionDocumento(
            id_postulacion=post.id_postulacion,
            id_requisito=id_requisito,
            s3_bucket=bucket,
            s3_key=key,
            nombre_original=fname,
            content_type=ct,
            tamano_bytes=len(body),
            estado_validacion="PENDIENTE",
        )
        db.add(doc_row)
    db.commit()
    db.refresh(doc_row)
    return DocumentoSubidoResponse(
        id_postulacion_documento=doc_row.id_postulacion_documento,
        id_requisito=doc_row.id_requisito,
        nombre_original=doc_row.nombre_original,
        content_type=doc_row.content_type,
        tamano_bytes=doc_row.tamano_bytes,
    )


@router.get(
    "/admin/convocatorias/{id_convocatoria}/postulaciones",
    response_model=AdminPostulacionesDeConvocatoriaResponse,
)
def listar_postulaciones_admin(
    id_convocatoria: UUID,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin),
):
    cv = db.get(Convocatoria, id_convocatoria)
    if not cv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada")

    posts = db.scalars(
        select(Postulacion)
        .where(Postulacion.id_convocatoria == id_convocatoria)
        .options(
            selectinload(Postulacion.convocatoria).selectinload(
                Convocatoria.requisitos_vinculo
            ),
            selectinload(Postulacion.documentos),
        )
        .order_by(Postulacion.creada_en.desc())
    ).all()

    user_ids = {p.id_usuario for p in posts}
    usuarios = {}
    if user_ids:
        for u in db.scalars(select(Usuario).where(Usuario.id_usuario.in_(user_ids))).all():
            usuarios[u.id_usuario] = u.correo

    total_reqs = len(cv.requisitos_vinculo)
    items_l: list[AdminPostulacionListItem] = []
    for post in posts:
        completos = len(post.documentos)
        items_l.append(
            AdminPostulacionListItem(
                id_postulacion=post.id_postulacion,
                estado=post.estado,
                creada_en=post.creada_en,
                usuario=PostulacionUsuarioResumen(
                    id_usuario=post.id_usuario,
                    correo=usuarios.get(post.id_usuario, ""),
                ),
                documentos_completos=min(completos, total_reqs),
                documentos_total=total_reqs,
            )
        )
    return AdminPostulacionesDeConvocatoriaResponse(items=items_l)


@router.get(
    "/admin/postulaciones/{id_postulacion}",
    response_model=AdminPostulacionDetalleResponse,
)
def detalle_postulacion_admin(
    id_postulacion: UUID,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin),
):
    try:
        get_s3_bucket()
    except ValueError:
        raise HTTPException(
            status_code=503,
            detail="S3_BUCKET no está configurado",
        )

    post = db.scalar(
        select(Postulacion)
        .where(Postulacion.id_postulacion == id_postulacion)
        .options(
            selectinload(Postulacion.convocatoria).selectinload(
                Convocatoria.requisitos_vinculo
            ).selectinload(ConvocatoriaRequisito.requisito),
            selectinload(Postulacion.documentos),
        )
    )
    if not post:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    usuario = db.get(Usuario, post.id_usuario)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    docs_by_req = {d.id_requisito: d for d in post.documentos}
    det_docs: list[AdminDocumentoDetalle] = []
    for cr in sorted(
        post.convocatoria.requisitos_vinculo, key=lambda x: x.requisito.codigo
    ):
        r = cr.requisito
        d = docs_by_req.get(r.id_requisito)
        if not d:
            continue
        url = presigned_get_url(d.s3_bucket, d.s3_key, expires_in=900)
        det_docs.append(
            AdminDocumentoDetalle(
                id_requisito=r.id_requisito,
                codigo=r.codigo,
                nombre=r.nombre,
                nombre_original=d.nombre_original,
                content_type=d.content_type,
                tamano_bytes=d.tamano_bytes,
                subido_en=d.subido_en,
                presigned_download_url=url,
            )
        )

    return AdminPostulacionDetalleResponse(
        id_postulacion=post.id_postulacion,
        id_convocatoria=post.id_convocatoria,
        nombre_convocatoria=post.convocatoria.nombre,
        estado=post.estado,
        creada_en=post.creada_en,
        usuario=PostulacionUsuarioResumen(
            id_usuario=usuario.id_usuario,
            correo=usuario.correo,
        ),
        documentos=det_docs,
    )
