from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from deps import CurrentUser, require_soporte_o_admin
from models import AuditoriaEvento, Usuario
from vacantes_schemas import AuditoriaEventoItem, AuditoriaListResponse

router = APIRouter(tags=["soporte", "auditoria"])


@router.get("/soporte/auditoria", response_model=AuditoriaListResponse)
def listar_auditoria(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_soporte_o_admin),
    desde: datetime | None = Query(None),
    hasta: datetime | None = Query(None),
    accion: str | None = Query(None),
    id_usuario: UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    stmt = select(AuditoriaEvento)
    count_stmt = select(func.count()).select_from(AuditoriaEvento)

    if desde:
        stmt = stmt.where(AuditoriaEvento.registrado_en >= desde)
        count_stmt = count_stmt.where(AuditoriaEvento.registrado_en >= desde)
    if hasta:
        stmt = stmt.where(AuditoriaEvento.registrado_en <= hasta)
        count_stmt = count_stmt.where(AuditoriaEvento.registrado_en <= hasta)
    if accion and accion.strip():
        stmt = stmt.where(AuditoriaEvento.accion == accion.strip())
        count_stmt = count_stmt.where(AuditoriaEvento.accion == accion.strip())
    if id_usuario:
        stmt = stmt.where(AuditoriaEvento.id_usuario == id_usuario)
        count_stmt = count_stmt.where(AuditoriaEvento.id_usuario == id_usuario)

    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(AuditoriaEvento.registrado_en.desc()).limit(limit).offset(offset)
    ).all()

    return AuditoriaListResponse(
        items=[
            AuditoriaEventoItem(
                id_evento=r.id_evento,
                id_usuario=r.id_usuario,
                accion=r.accion,
                registrado_en=r.registrado_en,
                ip=r.ip,
                detalle=r.detalle,
            )
            for r in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
