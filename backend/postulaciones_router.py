import hashlib
from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from database import get_db
from deps import CurrentUser, require_admin, require_usuario_aspirante
from expediente_service import (
    ESTADOS_EXPEDIENTE_ASPIRANTE_ENVIO,
    TransicionInvalidaError,
    calcular_progreso_obligatorios,
    cerrar_convocatorias_vencidas,
    convocatoria_acepta_expedientes,
    expediente_permite_edicion,
    hash_duplicado_en_expediente,
    requisitos_obligatorios_faltantes,
    transicion_expediente,
)
from models import (
    Convocatoria,
    ConvocatoriaRequisito,
    Postulacion,
    PostulacionDocumento,
    Usuario,
)
from s3_storage import (
    ALLOWED_CONTENT_TYPES,
    build_object_key,
    delete_object,
    get_s3_bucket,
    get_upload_max_bytes,
    presigned_get_url,
    sanitize_filename,
    upload_fileobj,
)
from vacantes_router import _convocatoria_from_model
from vacantes_schemas import (
    AdminDocumentoDetalle,
    AdminPostulacionDetalleResponse,
    AdminPostulacionListItem,
    AdminPostulacionesDeConvocatoriaResponse,
    CambiarEstadoPostulacionRequest,
    CambiarEstadoPostulacionResponse,
    DocumentoSubidoResponse,
    EnviarPostulacionResponse,
    MisPostulacionesItemResponse,
    MisPostulacionesListResponse,
    PostularResponse,
    PostulacionUsuarioResumen,
    RequisitoDocumentoEstado,
    RequisitoFaltanteItem,
)

router = APIRouter(tags=["postulaciones"])


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


def _mis_item_from_postulacion(p: Postulacion) -> MisPostulacionesItemResponse:
    c = p.convocatoria
    by_req = {d.id_requisito: d for d in p.documentos}
    progreso = calcular_progreso_obligatorios(c, p.documentos)
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

    motivo_rechazo = None
    if p.historial_estados:
        latest_hist = max(p.historial_estados, key=lambda x: x.creado_en)
        if latest_hist.motivo:
            motivo_rechazo = latest_hist.motivo

    return MisPostulacionesItemResponse(
        id_postulacion=p.id_postulacion,
        estado=p.estado,
        creada_en=p.creada_en,
        enviada_en=p.enviada_en,
        convocatoria=_convocatoria_from_model(c),
        requisitos=reqs,
        documentos_completos=completos,
        documentos_total=total,
        documentos_obligatorios_completos=progreso.completos,
        documentos_obligatorios_total=progreso.total,
        progreso_porcentaje=progreso.porcentaje,
        motivo_rechazo=motivo_rechazo,
    )


def _admin_list_item(
    post: Postulacion,
    correo: str,
) -> AdminPostulacionListItem:
    progreso = calcular_progreso_obligatorios(post.convocatoria, post.documentos)
    total_reqs = len(post.convocatoria.requisitos_vinculo)
    completos = len(post.documentos)
    return AdminPostulacionListItem(
        id_postulacion=post.id_postulacion,
        estado=post.estado,
        creada_en=post.creada_en,
        enviada_en=post.enviada_en,
        usuario=PostulacionUsuarioResumen(
            id_usuario=post.id_usuario,
            correo=correo,
        ),
        documentos_completos=min(completos, total_reqs),
        documentos_total=total_reqs,
        documentos_obligatorios_completos=progreso.completos,
        documentos_obligatorios_total=progreso.total,
        progreso_porcentaje=progreso.porcentaje,
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
    cerrar_convocatorias_vencidas(db)
    cv = db.get(Convocatoria, id_convocatoria)
    if not cv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada")
    if not convocatoria_acepta_expedientes(cv):
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
        estado="EN_INTEGRACION",
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


@router.post(
    "/aspirante/postulaciones/{id_postulacion}/enviar",
    response_model=EnviarPostulacionResponse,
)
def enviar_postulacion(
    id_postulacion: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_usuario_aspirante),
):
    cerrar_convocatorias_vencidas(db)
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
    if not post or post.id_usuario != user.id_usuario:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    cv = post.convocatoria
    if not convocatoria_acepta_expedientes(cv):
        raise HTTPException(
            status_code=400,
            detail="La convocatoria no está abierta para envío de expedientes",
        )
    if post.estado not in ESTADOS_EXPEDIENTE_ASPIRANTE_ENVIO:
        raise HTTPException(
            status_code=400,
            detail=f"No puedes enviar el expediente en estado {post.estado}",
        )

    faltantes = requisitos_obligatorios_faltantes(cv, post.documentos)
    if faltantes:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Faltan documentos obligatorios para enviar el expediente",
                "requisitos_faltantes": [
                    RequisitoFaltanteItem(
                        id_requisito=f.id_requisito,
                        codigo=f.codigo,
                        nombre=f.nombre,
                    ).model_dump()
                    for f in faltantes
                ],
            },
        )

    try:
        transicion_expediente(
            db,
            post,
            "ENVIADO",
            user.id_usuario,
            es_admin=False,
        )
        db.commit()
    except TransicionInvalidaError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=e.mensaje) from e

    db.refresh(post)
    progreso = calcular_progreso_obligatorios(cv, post.documentos)
    return EnviarPostulacionResponse(
        id_postulacion=post.id_postulacion,
        estado=post.estado,
        enviada_en=post.enviada_en,
        progreso_porcentaje=progreso.porcentaje,
    )


def _normalize_content_type(ct: str | None) -> str | None:
    if not ct:
        return None
    return ct.split(";")[0].strip().lower()


@router.get(
    "/aspirante/mis-postulaciones",
    response_model=MisPostulacionesListResponse,
)
def mis_postulaciones(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_usuario_aspirante),
):
    cerrar_convocatorias_vencidas(db)
    posts = db.scalars(
        select(Postulacion)
        .where(Postulacion.id_usuario == user.id_usuario)
        .options(
            selectinload(Postulacion.convocatoria).selectinload(
                Convocatoria.requisitos_vinculo
            ).selectinload(ConvocatoriaRequisito.requisito),
            selectinload(Postulacion.documentos),
            selectinload(Postulacion.historial_estados),
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
    cerrar_convocatorias_vencidas(db)
    try:
        bucket = get_s3_bucket()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    post = db.get(Postulacion, id_postulacion)
    if not post or post.id_usuario != user.id_usuario:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    if not expediente_permite_edicion(post.estado):
        raise HTTPException(
            status_code=403,
            detail=f"No puedes modificar documentos en estado {post.estado}",
        )

    cv = db.get(Convocatoria, post.id_convocatoria)
    if not cv or not convocatoria_acepta_expedientes(cv):
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

    contenido_hash = hashlib.sha256(body).hexdigest()
    dup = hash_duplicado_en_expediente(
        db, post.id_postulacion, contenido_hash, id_requisito
    )
    if dup:
        raise HTTPException(
            status_code=409,
            detail="El archivo es un duplicado exacto de otro documento ya cargado en este expediente",
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

    now = datetime.now(timezone.utc)
    if existing:
        delete_object(existing.s3_bucket, existing.s3_key)
        existing.s3_bucket = bucket
        existing.s3_key = key
        existing.nombre_original = fname
        existing.content_type = ct
        existing.tamano_bytes = len(body)
        existing.contenido_hash = contenido_hash
        existing.version = existing.version + 1
        existing.subido_en = now
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
            contenido_hash=contenido_hash,
            version=1,
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
        version=doc_row.version,
    )


@router.delete(
    "/aspirante/postulaciones/{id_postulacion}/documentos/{id_requisito}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def eliminar_documento_postulacion(
    id_postulacion: UUID,
    id_requisito: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_usuario_aspirante),
):
    cerrar_convocatorias_vencidas(db)
    post = db.get(Postulacion, id_postulacion)
    if not post or post.id_usuario != user.id_usuario:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    if not expediente_permite_edicion(post.estado):
        raise HTTPException(
            status_code=403,
            detail=f"No puedes eliminar documentos en estado {post.estado}",
        )

    cv = db.get(Convocatoria, post.id_convocatoria)
    if not cv or not convocatoria_acepta_expedientes(cv):
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar archivos fuera del periodo de vigencia",
        )

    if not _requisito_permite_para_convocatoria(db, post.id_convocatoria, id_requisito):
        raise HTTPException(
            status_code=400,
            detail="Este requisito no aplica a la convocatoria",
        )

    doc = db.scalar(
        select(PostulacionDocumento).where(
            PostulacionDocumento.id_postulacion == id_postulacion,
            PostulacionDocumento.id_requisito == id_requisito,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    delete_object(doc.s3_bucket, doc.s3_key)
    db.delete(doc)
    db.commit()


@router.get(
    "/admin/convocatorias/{id_convocatoria}/postulaciones",
    response_model=AdminPostulacionesDeConvocatoriaResponse,
)
def listar_postulaciones_admin(
    id_convocatoria: UUID,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin),
):
    cerrar_convocatorias_vencidas(db)
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
    usuarios: dict[UUID, str] = {}
    if user_ids:
        for u in db.scalars(select(Usuario).where(Usuario.id_usuario.in_(user_ids))).all():
            usuarios[u.id_usuario] = u.correo

    items_l = [
        _admin_list_item(post, usuarios.get(post.id_usuario, ""))
        for post in posts
    ]
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

    progreso = calcular_progreso_obligatorios(post.convocatoria, post.documentos)
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
        enviada_en=post.enviada_en,
        usuario=PostulacionUsuarioResumen(
            id_usuario=usuario.id_usuario,
            correo=usuario.correo,
        ),
        documentos=det_docs,
        documentos_obligatorios_completos=progreso.completos,
        documentos_obligatorios_total=progreso.total,
        progreso_porcentaje=progreso.porcentaje,
    )


@router.patch(
    "/admin/postulaciones/{id_postulacion}/estado",
    response_model=CambiarEstadoPostulacionResponse,
)
def cambiar_estado_postulacion_admin(
    id_postulacion: UUID,
    body: CambiarEstadoPostulacionRequest,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    post = db.get(Postulacion, id_postulacion)
    if not post:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    estado_anterior = post.estado
    try:
        transicion_expediente(
            db,
            post,
            body.estado,
            admin.id_usuario,
            es_admin=True,
            motivo=body.motivo,
        )
        db.commit()
    except TransicionInvalidaError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=e.mensaje) from e

    db.refresh(post)
    return CambiarEstadoPostulacionResponse(
        id_postulacion=post.id_postulacion,
        estado=post.estado,
        estado_anterior=estado_anterior,
    )
