import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMisPostulaciones,
  getPostulacionesAdmin,
  getPostulacionDetalleAdmin,
  postularConvocatoria,
  subirDocumentoPostulacion,
} from './api';

export const usePostularMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postularConvocatoria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-postulaciones'] });
      queryClient.invalidateQueries({ queryKey: ['convocatorias-activas'] });
    },
  });
};

export const useMisPostulacionesQuery = () => {
  return useQuery({
    queryKey: ['mis-postulaciones'],
    queryFn: getMisPostulaciones,
  });
};

export const useSubirDocumentoMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subirDocumentoPostulacion,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mis-postulaciones'] });
      queryClient.invalidateQueries({ queryKey: ['postulacion-detalle-admin', variables.idPostulacion] });
    },
  });
};

export const usePostulacionesAdminQuery = (idConvocatoria: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['postulaciones-admin', idConvocatoria],
    queryFn: () => getPostulacionesAdmin(idConvocatoria),
    enabled,
  });
};

export const usePostulacionDetalleAdminQuery = (idPostulacion: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['postulacion-detalle-admin', idPostulacion],
    queryFn: () => getPostulacionDetalleAdmin(idPostulacion),
    enabled,
  });
};
