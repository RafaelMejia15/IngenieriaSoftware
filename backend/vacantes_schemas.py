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


class ConvocatoriaListResponse(BaseModel):
    items: list[ConvocatoriaResponse]
