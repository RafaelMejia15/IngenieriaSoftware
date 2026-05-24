"""Exportación CSV/ZIP de postulaciones (RF-18)."""

from __future__ import annotations

import csv
import io
import zipfile
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from expediente_service import calcular_progreso_obligatorios
from models import Convocatoria, Postulacion, PostulacionDocumento, Usuario
from s3_storage import download_object_bytes


def build_postulaciones_csv(
    db: Session,
    id_convocatoria: UUID,
    *,
    estado: str | None = None,
    q: str | None = None,
) -> bytes:
    stmt = (
        select(Postulacion, Usuario.correo)
        .join(Usuario, Postulacion.id_usuario == Usuario.id_usuario)
        .where(Postulacion.id_convocatoria == id_convocatoria)
        .options(
            selectinload(Postulacion.convocatoria).selectinload(
                Convocatoria.requisitos_vinculo
            ),
            selectinload(Postulacion.documentos),
        )
        .order_by(Postulacion.creada_en.desc())
    )
    if estado and estado.strip():
        stmt = stmt.where(Postulacion.estado == estado.strip())
    if q and q.strip():
        stmt = stmt.where(Usuario.correo.ilike(f"%{q.strip()}%"))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "correo",
            "id_postulacion",
            "estado",
            "progreso_porcentaje",
            "documentos_obligatorios_completos",
            "documentos_obligatorios_total",
            "enviada_en",
            "creada_en",
            "cerrada_en",
        ]
    )
    for post, correo in db.execute(stmt).all():
        progreso = calcular_progreso_obligatorios(post.convocatoria, post.documentos)
        writer.writerow(
            [
                correo,
                str(post.id_postulacion),
                post.estado,
                progreso.porcentaje,
                progreso.completos,
                progreso.total,
                post.enviada_en.isoformat() if post.enviada_en else "",
                post.creada_en.isoformat() if post.creada_en else "",
                post.cerrada_en.isoformat() if post.cerrada_en else "",
            ]
        )
    return buf.getvalue().encode("utf-8-sig")


def build_expediente_zip(db: Session, id_postulacion: UUID) -> tuple[bytes, str]:
    post = db.scalar(
        select(Postulacion)
        .where(Postulacion.id_postulacion == id_postulacion)
        .options(selectinload(Postulacion.documentos).selectinload(PostulacionDocumento.requisito))
    )
    if not post:
        raise ValueError("Postulación no encontrada")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc in post.documentos:
            codigo = doc.requisito.codigo if doc.requisito else "DOC"
            arcname = f"{codigo}__{doc.nombre_original}"
            data = download_object_bytes(doc.s3_bucket, doc.s3_key)
            zf.writestr(arcname, data)

    ts = datetime.now().strftime("%Y%m%d")
    filename = f"expediente_{id_postulacion}_{ts}.zip"
    return zip_buf.getvalue(), filename
