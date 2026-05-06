import { useQuery } from "@tanstack/react-query";
import { getCatalogoRequisitos, getConvocatoriasActivas } from "./api";

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
export const useConvocatoriasActivasQuery = (q?: string) => {
  return useQuery({
    queryKey: ["convocatorias-activas", q],
    queryFn: () => getConvocatoriasActivas(q),
  });
};
