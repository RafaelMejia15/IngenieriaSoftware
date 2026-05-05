from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class CatalogoRequisito(Base):
    __tablename__ = "catalogo_requisito"

    id_requisito: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(500), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Convocatoria(Base):
    __tablename__ = "convocatoria"

    id_convocatoria: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_fin: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    estado: Mapped[str] = mapped_column(String(32), nullable=False, default="ABIERTA")
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    id_usuario_creador: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuario.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )

    requisitos_vinculo: Mapped[list[ConvocatoriaRequisito]] = relationship(
        "ConvocatoriaRequisito",
        back_populates="convocatoria",
        cascade="all, delete-orphan",
    )


class ConvocatoriaRequisito(Base):
    __tablename__ = "convocatoria_requisito"

    id_convocatoria: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("convocatoria.id_convocatoria", ondelete="CASCADE"),
        primary_key=True,
    )
    id_requisito: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalogo_requisito.id_requisito", ondelete="RESTRICT"),
        primary_key=True,
    )
    obligatorio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    convocatoria: Mapped[Convocatoria] = relationship(
        "Convocatoria", back_populates="requisitos_vinculo"
    )
    requisito: Mapped[CatalogoRequisito] = relationship("CatalogoRequisito")
