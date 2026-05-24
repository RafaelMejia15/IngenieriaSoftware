from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, false, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
    estado: Mapped[str] = mapped_column(
        String(32), nullable=False, default="EN_INTEGRACION"
    )
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    enviada_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cerrada_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    convocatoria: Mapped[Convocatoria] = relationship(
        "Convocatoria", back_populates="postulaciones"
    )
    documentos: Mapped[list[PostulacionDocumento]] = relationship(
        "PostulacionDocumento",
        back_populates="postulacion",
        cascade="all, delete-orphan",
    )
    historial_estados: Mapped[list[PostulacionEstadoHistorial]] = relationship(
        "PostulacionEstadoHistorial",
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
    contenido_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    comentario_observacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    validado_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    id_usuario_validador: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuario.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )

    postulacion: Mapped[Postulacion] = relationship(
        "Postulacion", back_populates="documentos"
    )
    requisito: Mapped[CatalogoRequisito] = relationship("CatalogoRequisito")
    historial_validaciones: Mapped[list[PostulacionDocumentoValidacionHistorial]] = (
        relationship(
            "PostulacionDocumentoValidacionHistorial",
            back_populates="documento",
            cascade="all, delete-orphan",
        )
    )


class PostulacionEstadoHistorial(Base):
    __tablename__ = "postulacion_estado_historial"

    id_historial: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    id_postulacion: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("postulacion.id_postulacion", ondelete="CASCADE"),
        nullable=False,
    )
    estado_anterior: Mapped[str] = mapped_column(String(32), nullable=False)
    estado_nuevo: Mapped[str] = mapped_column(String(32), nullable=False)
    id_usuario_actor: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuario.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    motivo: Mapped[str | None] = mapped_column(Text, nullable=True)

    postulacion: Mapped[Postulacion] = relationship(
        "Postulacion", back_populates="historial_estados"
    )


class PostulacionDocumentoValidacionHistorial(Base):
    __tablename__ = "postulacion_documento_validacion_historial"

    id_historial: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    id_postulacion_documento: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("postulacion_documento.id_postulacion_documento", ondelete="CASCADE"),
        nullable=False,
    )
    estado_anterior: Mapped[str] = mapped_column(String(32), nullable=False)
    estado_nuevo: Mapped[str] = mapped_column(String(32), nullable=False)
    comentario: Mapped[str | None] = mapped_column(String(500), nullable=True)
    id_usuario_actor: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuario.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    documento: Mapped[PostulacionDocumento] = relationship(
        "PostulacionDocumento", back_populates="historial_validaciones"
    )


class AuditoriaEvento(Base):
    __tablename__ = "auditoria_evento"

    id_evento: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    id_usuario: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuario.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    accion: Mapped[str] = mapped_column(String(64), nullable=False)
    registrado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    detalle: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
