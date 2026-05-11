import { apiClient } from "@/config/api";

export const postularConvocatoria = async (idConvocatoria: string) => {
  const { data } = await apiClient.post(
    `/aspirante/convocatorias/${idConvocatoria}/postular`,
  );
  return data;
};

export const getMisPostulaciones = async () => {
  const { data } = await apiClient.get("/aspirante/mis-postulaciones");
  return data;
};

// Se usa FormData para enviar archivos
export const subirDocumentoPostulacion = async ({
  idPostulacion,
  idRequisito,
  file,
}: {
  idPostulacion: string;
  idRequisito: string;
  file: any;
}) => {
  const formData = new FormData();
  formData.append("id_requisito", idRequisito);
  formData.append("file", file);

  const { data } = await apiClient.post(
    `/aspirante/postulaciones/${idPostulacion}/documentos`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return data;
};

export const getPostulacionesAdmin = async (idConvocatoria: string) => {
  const { data } = await apiClient.get(
    `/admin/convocatorias/${idConvocatoria}/postulaciones`,
  );
  return data;
};

export const getPostulacionDetalleAdmin = async (idPostulacion: string) => {
  const { data } = await apiClient.get(`/admin/postulaciones/${idPostulacion}`);
  return data;
};
