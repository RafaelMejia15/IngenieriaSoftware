import { useQuery } from "@tanstack/react-query";
import { getCatalogoRequisitos, getConvocatoriasActivas, getConvocatoriasAdmin } from "./api";

// ─── Catálogo de Requisitos ───────────────────────────────────────────────────
// Usado en el formulario del Admin para seleccionar requisitos
export const useCatalogoRequisitosQuery = () => {
  return useQuery({
    queryKey: ["catalogo-requisitos"],
    queryFn: getCatalogoRequisitos,
  });
};

// ─── Convocatorias Activas ────────────────────────────────────────────────────
// Usado en la pantalla del Aspirante, `q` es el texto de búsqueda opcional
export const useConvocatoriasActivasQuery = (q?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["convocatorias-activas", q],
    queryFn: () => getConvocatoriasActivas(q),
    enabled,
  });
};

// ─── Convocatorias Admin ──────────────────────────────────────────────────────
// Usado en la pantalla del Admin, `q` es el texto de búsqueda opcional
export const useConvocatoriasAdminQuery = (q?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["convocatorias-admin", q],
    queryFn: () => getConvocatoriasAdmin(q),
    enabled,
  });
};
