import { apiClient } from "@/config/api";
import {
  CatalogoRequisito,
  Convocatoria,
  ConvocatoriaCreatePayload,
  ConvocatoriaListResponse,
} from "@/types/vacantes.types";

/**
 * Lista todos los requisitos disponibles en el catálogo.
 *
 * @example
 * // Request: GET /catalogo/requisitos
 * // Headers: Authorization: Bearer {token}
 *
 * // Response: CatalogoRequisito[]
 * [{ id: "uuid", codigo: "REQ-01", nombre: "Título universitario", descripcion: "..." }]
 */
export const getCatalogoRequisitos = async (): Promise<CatalogoRequisito[]> => {
  console.log("[CATALOGO-REQUISITOS] GET /catalogo/requisitos");
  const response = await apiClient.get("/catalogo/requisitos");
  console.log("[CATALOGO-REQUISITOS] response →", response.data);
  return response.data;
};

/**
 * Crea una nueva convocatoria (solo admin).
 *
 * @example
 * // Request: POST /admin/convocatorias
 * // Payload:
 * {
 *   nombre: "Vacante Ingeniería de Software 2025",
 *   fecha_inicio: "2025-06-01T00:00:00Z",
 *   fecha_fin: "2025-06-30T23:59:59Z",
 *   requisito_ids: ["uuid-1", "uuid-2"]
 * }
 *
 * // Response: Convocatoria completa
 */
export const crearConvocatoria = async (
  payload: ConvocatoriaCreatePayload,
): Promise<Convocatoria> => {
  console.log("[CREAR-CONVOCATORIA] payload →", payload);
  const response = await apiClient.post("/admin/convocatorias", payload);
  console.log("[CREAR-CONVOCATORIA] response →", response.data);
  return response.data;
};

/**
 * Lista convocatorias activas (solo aspirante).
 * El parámetro `q` filtra por nombre (búsqueda parcial).
 *
 * @example
 * // Request: GET /aspirante/convocatorias?q=ingenieria
 *
 * // Response:
 * { items: [{ id, nombre, fecha_inicio, fecha_fin, estado, requisitos_obligatorios }] }
 */
export const getConvocatoriasActivas = async (
  q?: string,
): Promise<ConvocatoriaListResponse> => {
  console.log("[CONVOCATORIAS-ACTIVAS] GET /aspirante/convocatorias", q ? `?q=${q}` : "");
  const response = await apiClient.get("/aspirante/convocatorias", {
    params: q ? { q } : undefined,
  });
  console.log("[CONVOCATORIAS-ACTIVAS] response →", response.data);
  return response.data;
};
