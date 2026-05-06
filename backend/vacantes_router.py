from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, selectinload

from deps import require_admin, require_catalogo_reader, require_usuario_aspirante
from database import get_db
from models import CatalogoRequisito, Convocatoria, ConvocatoriaRequisito
from vacantes_schemas import (
    CatalogoRequisitoResponse,
    ConvocatoriaCreateRequest,
    ConvocatoriaListResponse,
    ConvocatoriaResponse,
    RequisitoEnConvocatoria,
)

router = APIRouter(tags=["vacantes", "catalogo"])


def _req_to_response(r: CatalogoRequisito) -> CatalogoRequisitoResponse:
    return CatalogoRequisitoResponse(
        id=r.id_requisito,
        codigo=r.codigo,
        nombre=r.nombre,
        descripcion=r.descripcion,
    )


@router.get("/catalogo/requisitos", response_model=list[CatalogoRequisitoResponse])
def listar_requisitos(
    db: Session = Depends(get_db),
    _user=Depends(require_catalogo_reader),
):
    rows = db.scalars(
        select(CatalogoRequisito).order_by(CatalogoRequisito.codigo)
    ).all()
    return [_req_to_response(r) for r in rows]


@router.post(
    "/admin/convocatorias",
    response_model=ConvocatoriaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_convocatoria(
    body: ConvocatoriaCreateRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if body.fecha_inicio >= body.fecha_fin:
        raise HTTPException(
            status_code=400,
            detail="fecha_inicio debe ser anterior a fecha_fin",
        )
    ids = list(dict.fromkeys(body.requisito_ids))
    found = db.scalars(
        select(CatalogoRequisito).where(CatalogoRequisito.id_requisito.in_(ids))
    ).all()
    if len(found) != len(ids):
        raise HTTPException(
            status_code=400,
            detail="Uno o más requisito_ids no existen en el catálogo",
        )

    conv = Convocatoria(
        nombre=body.nombre.strip(),
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        estado="ABIERTA",
        id_usuario_creador=admin.id_usuario,
    )
    for rid in ids:
        conv.requisitos_vinculo.append(
            ConvocatoriaRequisito(id_requisito=rid, obligatorio=True)
        )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return _convocatoria_to_response(db, conv.id_convocatoria)


@router.get("/admin/convocatorias", response_model=ConvocatoriaListResponse)
def listar_convocatorias_admin(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
    q: str | None = Query(
        None,
        description="Filtra por nombre (ILIKE)",
    ),
    solo_activas: bool = Query(
        False,
        description="Si es true, aplica la misma regla que el buscador de aspirantes (vigentes ahora en UTC).",
    ),
):
    stmt = select(Convocatoria).options(
        selectinload(Convocatoria.requisitos_vinculo).selectinload(
            ConvocatoriaRequisito.requisito
        ),
    )
    if solo_activas:
        stmt = stmt.where(_active_filters())
    if q and q.strip():
        stmt = stmt.where(Convocatoria.nombre.ilike(f"%{q.strip()}%"))
    stmt = stmt.order_by(Convocatoria.fecha_inicio.desc())
    rows = db.scalars(stmt).all()
    return ConvocatoriaListResponse(items=[_convocatoria_from_model(c) for c in rows])


def _active_filters():
    now = datetime.now(timezone.utc)
    return and_(
        Convocatoria.estado == "ABIERTA",
        Convocatoria.fecha_inicio <= now,
        Convocatoria.fecha_fin >= now,
    )


@router.get(
    "/aspirante/convocatorias",
    response_model=ConvocatoriaListResponse,
    summary="Buscador aspirante (solo convocatorias vigentes)",
    description=(
        "Solo rol **usuario** (aspirante). Solo devuelve convocatorias con estado "
        "**ABIERTA** y cuya vigencia incluye el instante actual en **UTC** "
        "(fecha_inicio ≤ ahora ≤ fecha_fin). Si creaste plazas con "
        "fecha_inicio en el futuro o fecha_fin ya pasada, aquí no aparecen. "
        "Los administradores deben usar **GET /admin/convocatorias**."
    ),
)
def buscar_convocatorias_activas(
    db: Session = Depends(get_db),
    _user=Depends(require_usuario_aspirante),
    q: str | None = Query(
        None,
        description="Texto para buscar en el nombre de la vacante (ILIKE)",
    ),
):
    stmt = (
        select(Convocatoria)
        .options(
            selectinload(Convocatoria.requisitos_vinculo).selectinload(
                ConvocatoriaRequisito.requisito
            ),
        )
        .where(_active_filters())
        .order_by(Convocatoria.fecha_inicio.desc())
    )
    if q and q.strip():
        stmt = stmt.where(Convocatoria.nombre.ilike(f"%{q.strip()}%"))
    rows = db.scalars(stmt).all()
    items = [_convocatoria_from_model(c) for c in rows]
    return ConvocatoriaListResponse(items=items)


def _convocatoria_to_response(db: Session, id_conv: UUID) -> ConvocatoriaResponse:
    c = db.scalar(
        select(Convocatoria)
        .options(
            selectinload(Convocatoria.requisitos_vinculo).selectinload(
                ConvocatoriaRequisito.requisito
            ),
        )
        .where(Convocatoria.id_convocatoria == id_conv)
    )
    if not c:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada")
    return _convocatoria_from_model(c)


def _convocatoria_from_model(c: Convocatoria) -> ConvocatoriaResponse:
    reqs: list[RequisitoEnConvocatoria] = []
    for v in sorted(c.requisitos_vinculo, key=lambda x: x.requisito.codigo):
        r = v.requisito
        reqs.append(
            RequisitoEnConvocatoria(
                id=r.id_requisito,
                codigo=r.codigo,
                nombre=r.nombre,
            )
        )
    return ConvocatoriaResponse(
        id=c.id_convocatoria,
        nombre=c.nombre,
        fecha_inicio=c.fecha_inicio,
        fecha_fin=c.fecha_fin,
        estado=c.estado,
        requisitos_obligatorios=reqs,
    )
