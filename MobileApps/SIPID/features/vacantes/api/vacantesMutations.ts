import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crearConvocatoria } from "./api";
import { ConvocatoriaCreatePayload } from "@/types/vacantes.types";

// ─── Crear Convocatoria (solo admin) ─────────────────────────────────────────
export const useCrearConvocatoriaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ConvocatoriaCreatePayload) => crearConvocatoria(payload),
    onSuccess: (response) => {
      console.log("[CREAR-CONVOCATORIA] ✅ Creada →", response);
      // Invalida el cache de convocatorias para que se refresquen automáticamente
      queryClient.invalidateQueries({ queryKey: ["convocatorias-activas"] });
    },
    onError: (error) => {
      console.error("[CREAR-CONVOCATORIA] ❌ Error →", error);
    },
  });
};
