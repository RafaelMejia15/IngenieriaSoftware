import hashlib
from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from auditoria_service import (
    ACCION_CAMBIO_ESTADO_EXPEDIENTE,
    ACCION_CARGA_DOCUMENTO,
    ACCION_DICTAMEN_FINAL,
    ACCION_ELIMINA_DOCUMENTO,
    ACCION_ENVIO_EXPEDIENTE,
    ACCION_EXPORT_CSV,
    ACCION_EXPORT_ZIP,
    ACCION_VALIDACION_DOCUMENTO,
    obtener_ip_cliente,
    registrar_auditoria,
)
from database import get_db
from deps import CurrentUser, require_admin, require_usuario_aspirante
from email_service import send_expediente_estado_email
from expediente_service import (
    ESTADOS_EXPEDIENTE_ASPIRANTE_ENVIO,
    TransicionInvalidaError,
    calcular_progreso_obligatorios,
    cerrar_convocatorias_vencidas,
    convocatoria_acepta_expedientes,
    expediente_esta_cerrado,
    expediente_permite_edicion,
    hash_duplicado_en_expediente,
    requisitos_obligatorios_faltantes,
    transicion_expediente,
)
from export_service import build_expediente_zip, build_postulaciones_csv
from models import (
    Convocatoria,
    ConvocatoriaRequisito,
    Postulacion,
    PostulacionDocumento,
    PostulacionDocumentoValidacionHistorial,
    PostulacionEstadoHistorial,
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
    DictamenFinalRequest,
    DictamenFinalResponse,
    DocumentoSubidoResponse,
    EnviarPostulacionResponse,
    ExpedienteHistorialItem,
    ExpedienteHistorialResponse,
    MisPostulacionesItemResponse,
    MisPostulacionesListResponse,
    PostularResponse,
    PostulacionUsuarioResumen,
    RequisitoDocumentoEstado,
    RequisitoFaltanteItem,
    ValidarDocumentoRequest,
    ValidarDocumentoResponse,
)

router = APIRouter(tags=["postulaciones"])


def _programar_email_estado(
    background_tasks: BackgroundTasks,
    db: Session,
    post: Postulacion,
    estado_anterior: str,
    motivo: str | None,
    comentarios_extra: str | None = None,
) -> None:
    usuario = db.get(Usuario, post.id_usuario)
    cv = db.get(Convocatoria, post.id_convocatoria)
    if not usuario or not cv:
        return
    background_tasks.add_task(
        send_expediente_estado_email,
        usuario.correo,
        cv.nombre,
        estado_anterior,
        post.estado,
        motivo,
        comentarios_extra,
    )


def _build_historial_unificado(
    db: Session, id_postulacion: UUID
) -> list[ExpedienteHistorialItem]:
    actor_ids: set[UUID] = set()
    estado_rows = db.scalars(
        select(PostulacionEstadoHistorial).where(
            PostulacionEstadoHistorial.id_postulacion == id_postulacion
        )
    ).all()
    doc_hist_rows = db.scalars(
        select(PostulacionDocumentoValidacionHistorial)
        .join(PostulacionDocumento)
        .where(PostulacionDocumento.id_postulacion == id_postulacion)
        .options(
            selectinload(PostulacionDocumentoValidacionHistorial.documento).selectinload(
                PostulacionDocumento.requisito
            )
        )
    ).all()
    for h in estado_rows:
        if h.id_usuario_actor:
            actor_ids.add(h.id_usuario_actor)
    for dh in doc_hist_rows:
        if dh.id_usuario_actor:
            actor_ids.add(dh.id_usuario_actor)

    correos: dict[UUID, str] = {}
    if actor_ids:
        for u in db.scalars(select(Usuario).where(Usuario.id_usuario.in_(actor_ids))).all():
            correos[u.id_usuario] = u.correo

    items: list[ExpedienteHistorialItem] = []
    for h in estado_rows:
        items.append(
            ExpedienteHistorialItem(
                tipo="CAMBIO_ESTADO",
                creado_en=h.creado_en,
                estado_anterior=h.estado_anterior,
                estado_nuevo=h.estado_nuevo,
                comentario=h.motivo,
                actor_correo=correos.get(h.id_usuario_actor) if h.id_usuario_actor else None,
            )
        )
    for dh in doc_hist_rows:
        req = dh.documento.requisito if dh.documento else None
        items.append(
            ExpedienteHistorialItem(
                tipo="VALIDACION_DOCUMENTO",
                creado_en=dh.creado_en,
                estado_anterior=dh.estado_anterior,
                estado_nuevo=dh.estado_nuevo,
                comentario=dh.comentario,
                actor_correo=correos.get(dh.id_usuario_actor) if dh.id_usuario_actor else None,
                codigo_requisito=req.codigo if req else None,
                nombre_requisito=req.nombre if req else None,
            )
        )
    items.sort(key=lambda x: x.creado_en, reverse=True)
    return items


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
                estado_validacion=doc.estado_validacion if doc else None,
                comentario_observacion=doc.comentario_observacion if doc else None,
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
    request: Request,
    background_tasks: BackgroundTasks,
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
    if expediente_esta_cerrado(post.estado):
        raise HTTPException(status_code=403, detail="El expediente está cerrado")
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
                        id_requisito=str(f.id_requisito),
                        codigo=f.codigo,
                        nombre=f.nombre,
                    ).model_dump()
                    for f in faltantes
                ],
            },
        )

    estado_anterior = post.estado
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

    registrar_auditoria(
        db,
        id_usuario=user.id_usuario,
        accion=ACCION_ENVIO_EXPEDIENTE,
        ip=obtener_ip_cliente(request),
        detalle={"id_postulacion": str(id_postulacion)},
    )
    _programar_email_estado(background_tasks, db, post, estado_anterior, "Envío de expediente completo")

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
    request: Request,
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

    if expediente_esta_cerrado(post.estado):
        raise HTTPException(status_code=403, detail="El expediente está cerrado")
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
        existing.estado_validacion = "PENDIENTE"
        existing.comentario_observacion = None
        existing.validado_en = None
        existing.id_usuario_validador = None
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
    registrar_auditoria(
        db,
        id_usuario=user.id_usuario,
        accion=ACCION_CARGA_DOCUMENTO,
        ip=obtener_ip_cliente(request),
        detalle={
            "id_postulacion": str(id_postulacion),
            "id_requisito": str(id_requisito),
            "id_postulacion_documento": str(doc_row.id_postulacion_documento),
        },
    )
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
    request: Request,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_usuario_aspirante),
):
    cerrar_convocatorias_vencidas(db)
    post = db.get(Postulacion, id_postulacion)
    if not post or post.id_usuario != user.id_usuario:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    if expediente_esta_cerrado(post.estado):
        raise HTTPException(status_code=403, detail="El expediente está cerrado")
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
    doc_id = doc.id_postulacion_documento
    db.delete(doc)
    db.commit()
    registrar_auditoria(
        db,
        id_usuario=user.id_usuario,
        accion=ACCION_ELIMINA_DOCUMENTO,
        ip=obtener_ip_cliente(request),
        detalle={
            "id_postulacion": str(id_postulacion),
            "id_requisito": str(id_requisito),
            "id_postulacion_documento": str(doc_id),
        },
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
                id_postulacion_documento=d.id_postulacion_documento,
                id_requisito=r.id_requisito,
                codigo=r.codigo,
                nombre=r.nombre,
                nombre_original=d.nombre_original,
                content_type=d.content_type,
                tamano_bytes=d.tamano_bytes,
                subido_en=d.subido_en,
                presigned_download_url=url,
                estado_validacion=d.estado_validacion,
                comentario_observacion=d.comentario_observacion,
                validado_en=d.validado_en,
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
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    post = db.scalar(
        select(Postulacion)
        .where(Postulacion.id_postulacion == id_postulacion)
        .options(selectinload(Postulacion.convocatoria))
    )
    if not post:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    estado_anterior = post.estado
    accion_audit = ACCION_CAMBIO_ESTADO_EXPEDIENTE
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

    registrar_auditoria(
        db,
        id_usuario=admin.id_usuario,
        accion=accion_audit,
        ip=obtener_ip_cliente(request),
        detalle={
            "id_postulacion": str(id_postulacion),
            "estado_anterior": estado_anterior,
            "estado_nuevo": post.estado,
        },
    )
    _programar_email_estado(background_tasks, db, post, estado_anterior, body.motivo)

    db.refresh(post)
    return CambiarEstadoPostulacionResponse(
        id_postulacion=post.id_postulacion,
        estado=post.estado,
        estado_anterior=estado_anterior,
    )


@router.post(
    "/admin/postulaciones/{id_postulacion}/dictamen",
    response_model=DictamenFinalResponse,
)
def emitir_dictamen_final(
    id_postulacion: UUID,
    body: DictamenFinalRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    post = db.scalar(
        select(Postulacion)
        .where(Postulacion.id_postulacion == id_postulacion)
        .options(selectinload(Postulacion.convocatoria))
    )
    if not post:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    estado_anterior = post.estado
    try:
        transicion_expediente(
            db,
            post,
            body.fallo,
            admin.id_usuario,
            es_admin=True,
            motivo=body.motivo,
        )
        db.commit()
    except TransicionInvalidaError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=e.mensaje) from e

    registrar_auditoria(
        db,
        id_usuario=admin.id_usuario,
        accion=ACCION_DICTAMEN_FINAL,
        ip=obtener_ip_cliente(request),
        detalle={
            "id_postulacion": str(id_postulacion),
            "fallo": body.fallo,
            "estado_anterior": estado_anterior,
        },
    )
    _programar_email_estado(background_tasks, db, post, estado_anterior, body.motivo)

    db.refresh(post)
    return DictamenFinalResponse(
        id_postulacion=post.id_postulacion,
        estado=post.estado,
        cerrada_en=post.cerrada_en or datetime.now(timezone.utc),
    )


@router.patch(
    "/admin/postulaciones/{id_postulacion}/documentos/{id_postulacion_documento}/validacion",
    response_model=ValidarDocumentoResponse,
)
def validar_documento_admin(
    id_postulacion: UUID,
    id_postulacion_documento: UUID,
    body: ValidarDocumentoRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    post = db.get(Postulacion, id_postulacion)
    if not post:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")
    if expediente_esta_cerrado(post.estado):
        raise HTTPException(status_code=403, detail="El expediente está cerrado")
    if post.estado != "EN_REVISION":
        raise HTTPException(
            status_code=400,
            detail="Solo se validan documentos cuando el expediente está en EN_REVISION",
        )

    doc = db.scalar(
        select(PostulacionDocumento).where(
            PostulacionDocumento.id_postulacion_documento == id_postulacion_documento,
            PostulacionDocumento.id_postulacion == id_postulacion,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    if body.decision == "RECHAZADA":
        if not body.comentario or not body.comentario.strip():
            raise HTTPException(
                status_code=400,
                detail="El comentario es obligatorio al rechazar un documento",
            )

    estado_anterior = doc.estado_validacion
    now = datetime.now(timezone.utc)
    comentario = body.comentario.strip() if body.comentario else None
    doc.estado_validacion = body.decision
    doc.comentario_observacion = comentario if body.decision == "RECHAZADA" else None
    doc.validado_en = now
    doc.id_usuario_validador = admin.id_usuario

    db.add(
        PostulacionDocumentoValidacionHistorial(
            id_postulacion_documento=doc.id_postulacion_documento,
            estado_anterior=estado_anterior,
            estado_nuevo=body.decision,
            comentario=comentario,
            id_usuario_actor=admin.id_usuario,
        )
    )
    db.commit()
    db.refresh(doc)

    registrar_auditoria(
        db,
        id_usuario=admin.id_usuario,
        accion=ACCION_VALIDACION_DOCUMENTO,
        ip=obtener_ip_cliente(request),
        detalle={
            "id_postulacion": str(id_postulacion),
            "id_postulacion_documento": str(id_postulacion_documento),
            "decision": body.decision,
        },
    )

    return ValidarDocumentoResponse(
        id_postulacion_documento=doc.id_postulacion_documento,
        estado_validacion=doc.estado_validacion,
        comentario_observacion=doc.comentario_observacion,
        validado_en=doc.validado_en,
    )


@router.get(
    "/admin/postulaciones/{id_postulacion}/historial",
    response_model=ExpedienteHistorialResponse,
)
def historial_expediente_admin(
    id_postulacion: UUID,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin),
):
    post = db.get(Postulacion, id_postulacion)
    if not post:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")
    return ExpedienteHistorialResponse(
        items=_build_historial_unificado(db, id_postulacion)
    )


@router.get("/admin/convocatorias/{id_convocatoria}/postulaciones/export.csv")
def exportar_postulaciones_csv(
    id_convocatoria: UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
    estado: str | None = Query(None),
    q: str | None = Query(None, description="Filtra por correo del aspirante"),
):
    cv = db.get(Convocatoria, id_convocatoria)
    if not cv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada")

    data = build_postulaciones_csv(db, id_convocatoria, estado=estado, q=q)
    registrar_auditoria(
        db,
        id_usuario=admin.id_usuario,
        accion=ACCION_EXPORT_CSV,
        ip=obtener_ip_cliente(request),
        detalle={"id_convocatoria": str(id_convocatoria), "estado": estado, "q": q},
    )
    filename = f"postulaciones_{id_convocatoria}.csv"
    return Response(
        content=data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/admin/postulaciones/{id_postulacion}/export.zip")
def exportar_expediente_zip(
    id_postulacion: UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    try:
        get_s3_bucket()
    except ValueError:
        raise HTTPException(status_code=503, detail="S3_BUCKET no está configurado")

    try:
        data, filename = build_expediente_zip(db, id_postulacion)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    registrar_auditoria(
        db,
        id_usuario=admin.id_usuario,
        accion=ACCION_EXPORT_ZIP,
        ip=obtener_ip_cliente(request),
        detalle={"id_postulacion": str(id_postulacion)},
    )
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
