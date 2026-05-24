"""Reglas de negocio Sprint 5: convocatorias, expediente y progreso documental."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from models import Convocatoria, Postulacion, PostulacionDocumento, PostulacionEstadoHistorial

ESTADOS_EXPEDIENTE_ASPIRANTE_ENVIO = frozenset({"EN_INTEGRACION", "CON_OBSERVACIONES"})
ESTADOS_EXPEDIENTE_EDICION = frozenset({"EN_INTEGRACION", "CON_OBSERVACIONES"})
ESTADOS_EXPEDIENTE_CERRADO = frozenset({"ACEPTADO", "DESESTIMADO"})

TRANSICIONES_ASPIRANTE: dict[str, frozenset[str]] = {
    "EN_INTEGRACION": frozenset({"ENVIADO"}),
    "CON_OBSERVACIONES": frozenset({"ENVIADO"}),
}

TRANSICIONES_ADMIN: dict[str, frozenset[str]] = {
    "ENVIADO": frozenset({"EN_REVISION"}),
    "EN_REVISION": frozenset({"CON_OBSERVACIONES", "ACEPTADO", "DESESTIMADO"}),
}


class TransicionInvalidaError(Exception):
    def __init__(self, mensaje: str):
        self.mensaje = mensaje
        super().__init__(mensaje)


@dataclass(frozen=True)
class ProgresoObligatorios:
    completos: int
    total: int
    porcentaje: int


@dataclass(frozen=True)
class RequisitoFaltante:
    id_requisito: UUID
    codigo: str
    nombre: str


def cerrar_convocatorias_vencidas(db: Session) -> int:
    """RF-06: ABIERTA con fecha_fin pasada → INACTIVA."""
    now = datetime.now(timezone.utc)
    result = db.execute(
        update(Convocatoria)
        .where(
            Convocatoria.estado == "ABIERTA",
            Convocatoria.fecha_fin < now,
        )
        .values(estado="INACTIVA")
    )
    if result.rowcount:
        db.commit()
    return result.rowcount or 0


def convocatoria_acepta_expedientes(cv: Convocatoria) -> bool:
    now = datetime.now(timezone.utc)
    return (
        cv.estado == "ABIERTA"
        and cv.fecha_inicio <= now
        and cv.fecha_fin >= now
    )


def expediente_permite_edicion(estado: str) -> bool:
    return estado in ESTADOS_EXPEDIENTE_EDICION


def expediente_esta_cerrado(estado: str) -> bool:
    return estado in ESTADOS_EXPEDIENTE_CERRADO


def _docs_por_requisito(documentos: list[PostulacionDocumento]) -> dict[UUID, PostulacionDocumento]:
    return {d.id_requisito: d for d in documentos}


def calcular_progreso_obligatorios(
    convocatoria: Convocatoria,
    documentos: list[PostulacionDocumento],
) -> ProgresoObligatorios:
    by_req = _docs_por_requisito(documentos)
    oblig = [cr for cr in convocatoria.requisitos_vinculo if cr.obligatorio]
    total = len(oblig)
    if total == 0:
        return ProgresoObligatorios(completos=0, total=0, porcentaje=100)
    completos = sum(1 for cr in oblig if cr.id_requisito in by_req)
    porcentaje = round(completos * 100 / total)
    return ProgresoObligatorios(completos=completos, total=total, porcentaje=porcentaje)


def requisitos_obligatorios_faltantes(
    convocatoria: Convocatoria,
    documentos: list[PostulacionDocumento],
) -> list[RequisitoFaltante]:
    by_req = _docs_por_requisito(documentos)
    faltantes: list[RequisitoFaltante] = []
    for cr in sorted(convocatoria.requisitos_vinculo, key=lambda x: x.requisito.codigo):
        if not cr.obligatorio:
            continue
        if cr.id_requisito not in by_req:
            r = cr.requisito
            faltantes.append(
                RequisitoFaltante(
                    id_requisito=r.id_requisito,
                    codigo=r.codigo,
                    nombre=r.nombre,
                )
            )
    return faltantes


def _transicion_permitida(estado_actual: str, estado_nuevo: str, es_admin: bool) -> bool:
    if es_admin:
        permitidos = TRANSICIONES_ADMIN.get(estado_actual, frozenset())
    else:
        permitidos = TRANSICIONES_ASPIRANTE.get(estado_actual, frozenset())
    return estado_nuevo in permitidos


def transicion_expediente(
    db: Session,
    post: Postulacion,
    estado_nuevo: str,
    id_usuario_actor: UUID | None,
    *,
    es_admin: bool,
    motivo: str | None = None,
) -> None:
    """RF-13: aplica transición válida y registra historial."""
    if expediente_esta_cerrado(post.estado):
        raise TransicionInvalidaError("El expediente está cerrado y no admite cambios")
    if post.estado == estado_nuevo:
        raise TransicionInvalidaError("El expediente ya está en ese estado")
    if not _transicion_permitida(post.estado, estado_nuevo, es_admin):
        raise TransicionInvalidaError(
            f"Transición no permitida: {post.estado} → {estado_nuevo}"
        )

    estado_anterior = post.estado
    post.estado = estado_nuevo
    now = datetime.now(timezone.utc)
    if estado_nuevo == "ENVIADO":
        post.enviada_en = now
    if estado_nuevo in ESTADOS_EXPEDIENTE_CERRADO:
        post.cerrada_en = now

    db.add(
        PostulacionEstadoHistorial(
            id_postulacion=post.id_postulacion,
            estado_anterior=estado_anterior,
            estado_nuevo=estado_nuevo,
            id_usuario_actor=id_usuario_actor,
            motivo=motivo,
        )
    )


def hash_duplicado_en_expediente(
    db: Session,
    id_postulacion: UUID,
    contenido_hash: str,
    id_requisito_excluir: UUID,
) -> PostulacionDocumento | None:
    """RF-09: otro requisito del mismo expediente con el mismo hash."""
    dup = db.scalar(
        select(PostulacionDocumento).where(
            PostulacionDocumento.id_postulacion == id_postulacion,
            PostulacionDocumento.contenido_hash == contenido_hash,
            PostulacionDocumento.id_requisito != id_requisito_excluir,
        )
    )
    return dup
