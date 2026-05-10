from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, false, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Rol(Base):
    """Sincronizado con tabla `rol` creada en SQL (auth). Solo para FK / metadatos ORM."""

    __tablename__ = "rol"

    id_rol: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)


class Usuario(Base):
    """Sincronizado con tabla `usuario` (auth). Necesario para FK desde `convocatoria`."""

    __tablename__ = "usuario"

    id_usuario: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    id_rol: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rol.id_rol"), nullable=False
    )
    correo: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    esta_activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=false()
    )
    fecha_registro: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        server_default=func.now(),
    )
    token_verificacion: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    token_verificacion_expira: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    token_recuperacion: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    token_recuperacion_expira: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


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
    postulaciones: Mapped[list[Postulacion]] = relationship(
        "Postulacion",
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


class Postulacion(Base):
    __tablename__ = "postulacion"

    id_postulacion: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    id_convocatoria: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("convocatoria.id_convocatoria", ondelete="CASCADE"),
        nullable=False,
    )
    id_usuario: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuario.id_usuario", ondelete="CASCADE"),
        nullable=False,
    )
    estado: Mapped[str] = mapped_column(String(32), nullable=False, default="RECIBIDA")
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    convocatoria: Mapped[Convocatoria] = relationship(
        "Convocatoria", back_populates="postulaciones"
    )
    documentos: Mapped[list[PostulacionDocumento]] = relationship(
        "PostulacionDocumento",
        back_populates="postulacion",
        cascade="all, delete-orphan",
    )


class PostulacionDocumento(Base):
    __tablename__ = "postulacion_documento"

    id_postulacion_documento: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    id_postulacion: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("postulacion.id_postulacion", ondelete="CASCADE"),
        nullable=False,
    )
    id_requisito: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalogo_requisito.id_requisito", ondelete="RESTRICT"),
        nullable=False,
    )
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(Text, nullable=False)
    nombre_original: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    tamano_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    estado_validacion: Mapped[str] = mapped_column(
        String(32), nullable=False, default="PENDIENTE"
    )
    subido_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    postulacion: Mapped[Postulacion] = relationship(
        "Postulacion", back_populates="documentos"
    )
    requisito: Mapped[CatalogoRequisito] = relationship("CatalogoRequisito")
