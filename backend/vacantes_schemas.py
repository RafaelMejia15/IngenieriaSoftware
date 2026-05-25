from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class CatalogoRequisitoResponse(BaseModel):
    id: UUID = Field(description="ID del requisito en catálogo")
    codigo: str
    nombre: str
    descripcion: str | None = None


class ConvocatoriaCreateRequest(BaseModel):
    nombre: str = Field(min_length=1, max_length=2000)
    fecha_inicio: datetime
    fecha_fin: datetime
    requisito_ids: list[UUID] = Field(
        min_length=1,
        description="IDs del catálogo de requisitos obligatorios para esta vacante",
    )


class RequisitoEnConvocatoria(BaseModel):
    id: UUID
    codigo: str
    nombre: str


class ConvocatoriaResponse(BaseModel):
    id: UUID
    nombre: str
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str
    requisitos_obligatorios: list[RequisitoEnConvocatoria]


class ConvocatoriaParaAspiranteResponse(ConvocatoriaResponse):
    ya_postulo: bool
    id_postulacion: UUID | None = None


class ConvocatoriaParaAspiranteListResponse(BaseModel):
    items: list[ConvocatoriaParaAspiranteResponse]


class ConvocatoriaListResponse(BaseModel):
    items: list[ConvocatoriaResponse]


class PostularResponse(BaseModel):
    id_postulacion: UUID
    estado: str
    id_convocatoria: UUID


class RequisitoDocumentoEstado(BaseModel):
    id_requisito: UUID
    codigo: str
    nombre: str
    obligatorio: bool
    documento_subido: bool
    nombre_archivo_subido: str | None = None
    content_type_subido: str | None = None
    subido_en: datetime | None = None
    estado_validacion: str | None = None
    comentario_observacion: str | None = None


class MisPostulacionesItemResponse(BaseModel):
    id_postulacion: UUID
    estado: str
    creada_en: datetime
    enviada_en: datetime | None = None
    convocatoria: ConvocatoriaResponse
    requisitos: list[RequisitoDocumentoEstado]
    documentos_completos: int
    documentos_total: int
    documentos_obligatorios_completos: int
    documentos_obligatorios_total: int
    progreso_porcentaje: int = Field(ge=0, le=100)
    motivo_rechazo: str | None = None


class MisPostulacionesListResponse(BaseModel):
    items: list[MisPostulacionesItemResponse]


class PostulacionUsuarioResumen(BaseModel):
    id_usuario: UUID
    correo: str


class AdminPostulacionListItem(BaseModel):
    id_postulacion: UUID
    estado: str
    creada_en: datetime
    enviada_en: datetime | None = None
    usuario: PostulacionUsuarioResumen
    documentos_completos: int
    documentos_total: int
    documentos_obligatorios_completos: int
    documentos_obligatorios_total: int
    progreso_porcentaje: int = Field(ge=0, le=100)


class AdminPostulacionesDeConvocatoriaResponse(BaseModel):
    items: list[AdminPostulacionListItem]


class AdminDocumentoDetalle(BaseModel):
    id_postulacion_documento: UUID
    id_requisito: UUID
    codigo: str
    nombre: str
    nombre_original: str
    content_type: str
    tamano_bytes: int
    subido_en: datetime
    presigned_download_url: str
    estado_validacion: str
    comentario_observacion: str | None = None
    validado_en: datetime | None = None


class AdminPostulacionDetalleResponse(BaseModel):
    id_postulacion: UUID
    id_convocatoria: UUID
    nombre_convocatoria: str
    estado: str
    creada_en: datetime
    enviada_en: datetime | None = None
    usuario: PostulacionUsuarioResumen
    documentos: list[AdminDocumentoDetalle]
    documentos_obligatorios_completos: int
    documentos_obligatorios_total: int
    progreso_porcentaje: int = Field(ge=0, le=100)


class DocumentoSubidoResponse(BaseModel):
    id_postulacion_documento: UUID
    id_requisito: UUID
    nombre_original: str
    content_type: str
    tamano_bytes: int
    version: int


class RequisitoFaltanteItem(BaseModel):
    id_requisito: UUID
    codigo: str
    nombre: str


class EnviarPostulacionResponse(BaseModel):
    id_postulacion: UUID
    estado: str
    enviada_en: datetime
    progreso_porcentaje: int = Field(ge=0, le=100)


EstadoExpedienteAdmin = Literal[
    "EN_REVISION", "CON_OBSERVACIONES", "ACEPTADO", "DESESTIMADO"
]


class CambiarEstadoPostulacionRequest(BaseModel):
    estado: EstadoExpedienteAdmin
    motivo: str | None = Field(default=None, max_length=2000)


class CambiarEstadoPostulacionResponse(BaseModel):
    id_postulacion: UUID
    estado: str
    estado_anterior: str


class PostulacionEstadoHistorialItem(BaseModel):
    estado_anterior: str
    estado_nuevo: str
    creado_en: datetime
    motivo: str | None = None


DecisionValidacionDocumento = Literal["ACEPTADA", "RECHAZADA"]
FalloDictamen = Literal["ACEPTADO", "DESESTIMADO"]


class ValidarDocumentoRequest(BaseModel):
    decision: DecisionValidacionDocumento
    comentario: str | None = Field(default=None, max_length=500)


class ValidarDocumentoResponse(BaseModel):
    id_postulacion_documento: UUID
    estado_validacion: str
    comentario_observacion: str | None = None
    validado_en: datetime


class ExpedienteHistorialItem(BaseModel):
    tipo: Literal["CAMBIO_ESTADO", "VALIDACION_DOCUMENTO"]
    creado_en: datetime
    estado_anterior: str
    estado_nuevo: str
    comentario: str | None = None
    actor_correo: str | None = None
    codigo_requisito: str | None = None
    nombre_requisito: str | None = None


class ExpedienteHistorialResponse(BaseModel):
    items: list[ExpedienteHistorialItem]


class DictamenFinalRequest(BaseModel):
    fallo: FalloDictamen
    motivo: str | None = Field(default=None, max_length=2000)


class DictamenFinalResponse(BaseModel):
    id_postulacion: UUID
    estado: str
    cerrada_en: datetime


class AuditoriaEventoItem(BaseModel):
    id_evento: UUID
    id_usuario: UUID | None
    accion: str
    registrado_en: datetime
    ip: str | None
    detalle: dict | None = None


class AuditoriaListResponse(BaseModel):
    items: list[AuditoriaEventoItem]
    total: int
    limit: int
    offset: int
