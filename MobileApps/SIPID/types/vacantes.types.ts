// ─── Catálogo de Requisitos ───────────────────────────────────────────────────
export interface CatalogoRequisito {
  id: string;          // UUID
  codigo: string;
  nombre: string;
  descripcion?: string;
}

// ─── Convocatoria (Create) ────────────────────────────────────────────────────
export interface ConvocatoriaCreatePayload {
  nombre: string;
  fecha_inicio: string; // ISO 8601: "2025-06-01T00:00:00Z"
  fecha_fin: string;    // ISO 8601: "2025-06-30T23:59:59Z"
  requisito_ids: string[]; // UUIDs — mínimo 1
}

// ─── Requisito embebido en la convocatoria (response) ─────────────────────────
export interface RequisitoEnConvocatoria {
  id: string;
  codigo: string;
  nombre: string;
}

// ─── Convocatoria completa (response) ─────────────────────────────────────────
export interface Convocatoria {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  requisitos_obligatorios: RequisitoEnConvocatoria[];
}

export interface ConvocatoriaParaAspiranteResponse extends Convocatoria {
  ya_postulo: boolean;
  id_postulacion: string | null;
}

// ─── Lista de Convocatorias (response) ────────────────────────────────────────
export interface ConvocatoriaListResponse {
  items: Convocatoria[];
}

export interface ConvocatoriaParaAspiranteListResponse {
  items: ConvocatoriaParaAspiranteResponse[];
}
