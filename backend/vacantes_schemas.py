from datetime import datetime
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


class MisPostulacionesItemResponse(BaseModel):
    id_postulacion: UUID
    estado: str
    creada_en: datetime
    convocatoria: ConvocatoriaResponse
    requisitos: list[RequisitoDocumentoEstado]
    documentos_completos: int
    documentos_total: int


class MisPostulacionesListResponse(BaseModel):
    items: list[MisPostulacionesItemResponse]


class PostulacionUsuarioResumen(BaseModel):
    id_usuario: UUID
    correo: str


class AdminPostulacionListItem(BaseModel):
    id_postulacion: UUID
    estado: str
    creada_en: datetime
    usuario: PostulacionUsuarioResumen
    documentos_completos: int
    documentos_total: int


class AdminPostulacionesDeConvocatoriaResponse(BaseModel):
    items: list[AdminPostulacionListItem]


class AdminDocumentoDetalle(BaseModel):
    id_requisito: UUID
    codigo: str
    nombre: str
    nombre_original: str
    content_type: str
    tamano_bytes: int
    subido_en: datetime
    presigned_download_url: str


class AdminPostulacionDetalleResponse(BaseModel):
    id_postulacion: UUID
    id_convocatoria: UUID
    nombre_convocatoria: str
    estado: str
    creada_en: datetime
    usuario: PostulacionUsuarioResumen
    documentos: list[AdminDocumentoDetalle]


class DocumentoSubidoResponse(BaseModel):
    id_postulacion_documento: UUID
    id_requisito: UUID
    nombre_original: str
    content_type: str
    tamano_bytes: int
