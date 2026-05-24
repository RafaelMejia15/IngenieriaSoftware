"""Auditoría de aplicación (RF-18): eventos críticos con usuario, acción, IP y detalle."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import Request
from sqlalchemy.orm import Session

from models import AuditoriaEvento

logger = logging.getLogger(__name__)

ACCION_LOGIN = "LOGIN"
ACCION_REGISTRO_CUENTA = "REGISTRO_CUENTA"
ACCION_CARGA_DOCUMENTO = "CARGA_DOCUMENTO"
ACCION_ELIMINA_DOCUMENTO = "ELIMINA_DOCUMENTO"
ACCION_ENVIO_EXPEDIENTE = "ENVIO_EXPEDIENTE"
ACCION_VALIDACION_DOCUMENTO = "VALIDACION_DOCUMENTO"
ACCION_CAMBIO_ESTADO_EXPEDIENTE = "CAMBIO_ESTADO_EXPEDIENTE"
ACCION_DICTAMEN_FINAL = "DICTAMEN_FINAL"
ACCION_EXPORT_CSV = "EXPORT_CSV"
ACCION_EXPORT_ZIP = "EXPORT_ZIP"


def obtener_ip_cliente(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    if request.client and request.client.host:
        return request.client.host[:45]
    return "unknown"


def registrar_auditoria(
    db: Session,
    *,
    id_usuario: UUID | None,
    accion: str,
    ip: str | None,
    detalle: dict[str, Any] | None = None,
) -> None:
    try:
        db.add(
            AuditoriaEvento(
                id_usuario=id_usuario,
                accion=accion,
                ip=ip,
                detalle=detalle,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("No se pudo registrar auditoría: %s", accion)
