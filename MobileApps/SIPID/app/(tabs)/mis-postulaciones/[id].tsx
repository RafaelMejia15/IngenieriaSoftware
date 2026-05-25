import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Platform, Pressable } from 'react-native';
import {
  useMisPostulacionesQuery,
  useSubirDocumentoMutation,
  useEliminarDocumentoMutation,
  useEnviarPostulacionMutation
} from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { useState } from 'react';
import AntDesign from '@expo/vector-icons/AntDesign';

export default function MisPostulacionesDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data, isLoading } = useMisPostulacionesQuery();
  const { mutateAsync: subirArchivo, isPending } = useSubirDocumentoMutation();
  const { mutateAsync: eliminarArchivo, isPending: isDeleting } = useEliminarDocumentoMutation();
  const { mutateAsync: enviarPostulacion, isPending: isSending } = useEnviarPostulacionMutation();
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [errorEnvio, setErrorEnvio] = useState<any[]>([]);

  const postulacion = data?.items.find((p: any) => p.id_postulacion === id);
  const esEditable = postulacion?.estado === 'EN_INTEGRACION' || postulacion?.estado === 'CON_OBSERVACIONES';
  const estaVigente = postulacion?.convocatoria.estado === 'ABIERTA';

  const handleFileSelect = (e: any, idRequisito: string) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [idRequisito]: file }));
    }
  };

  const handleUploadWeb = async (idRequisito: string) => {
    const file = selectedFiles[idRequisito];
    if (!file) return;
    try {
      await subirArchivo({ idPostulacion: id as string, idRequisito, file });
      alert('Archivo subido con éxito');
      setSelectedFiles(prev => {
        const next = { ...prev };
        delete next[idRequisito];
        return next;
      });
    } catch (err: any) {
      console.log('Error: ' + err.response?.data?.detail);
    }
  };

  const handleDelete = async (idRequisito: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;
    try {
      await eliminarArchivo({ idPostulacion: id as string, idRequisito });
      alert('Documento eliminado');
    } catch (err) {
      alert('Error al eliminar documento');
    }
  };

  const handleEnviar = async () => {
    setErrorEnvio([]);
    try {
      await enviarPostulacion(id as string);
      alert('Expediente enviado con éxito');
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.detail?.requisitos_faltantes) {
        setErrorEnvio(err.response.data.detail.requisitos_faltantes);
      } else {
        alert('Error al enviar postulación: ' + (err.response?.data?.detail || 'Desconocido'));
      }
    }
  };

  const renderUploadButton = (req: any) => {
    if (req.documento_subido) {
      return (
        <View className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl mt-3">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-emerald-400 font-medium text-sm">Archivo subido</Text>
              <Text className="text-emerald-400/70 text-xs mt-0.5" numberOfLines={1}>{req.nombre_archivo_subido}</Text>
            </View>
            <Badge label="Completado" variant="success" />
          </View>
          {esEditable && estaVigente && (
            <View className="flex-row items-center justify-end border-t border-emerald-500/20 pt-3">
              {Platform.OS === 'web' && (
                <View className="flex-1 mr-3">
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '6px',
                      border: '1px dashed rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: 'transparent',
                      color: '#34d399',
                      fontSize: '12px'
                    }}
                    onChange={(e) => handleFileSelect(e, req.id_requisito)}
                    disabled={isPending || isDeleting}
                  />
                </View>
              )}
              {selectedFiles[req.id_requisito] ? (
                <Button
                  label="Reemplazar"
                  variant="glass"
                  onPress={() => handleUploadWeb(req.id_requisito)}
                  loading={isPending}
                />
              ) : (
                <Button
                  label=''
                  icon={<AntDesign name="delete" size={16} color="#ef4444" />}
                  variant="outline"
                  onPress={() => handleDelete(req.id_requisito)}
                  loading={isDeleting}
                />
              )}
            </View>
          )}
        </View>
      );
    }

    if (!esEditable || !estaVigente) {
      return null;
    }

    if (Platform.OS === 'web') {
      const selectedFile = selectedFiles[req.id_requisito];
      return (
        <View className="mt-3">
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png"
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              border: '1px dashed #3f3f46',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: '#09090b',
              color: '#a1a1aa',
            }}
            onChange={(e) => handleFileSelect(e, req.id_requisito)}
            disabled={isPending || isDeleting}
          />
          {selectedFile && (
            <View className="pt-2">
              <Button
                label="Enviar archivo"
                onPress={() => handleUploadWeb(req.id_requisito)}
                loading={isPending}
              />
            </View>
          )}
        </View>
      );
    }

    return (
      <View className="mt-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
        <Text className="text-amber-400 text-sm font-medium">Sube tus archivos desde la versión Web</Text>
        <Text className="text-amber-400/70 text-xs mt-1">Por el momento, la subida nativa no está habilitada en la app móvil.</Text>
      </View>
    );
  };

  if (isLoading || !postulacion) {
    return (
      <View className="flex-1 justify-center items-center bg-zinc-950">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} className="flex-1 bg-zinc-950">
      <Header title="Detalle de Postulación" showHub={true} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">
          <View className="mb-6">
            <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">Postulación</Text>
            <Text className="text-3xl font-bold text-zinc-50 tracking-tight">{postulacion.convocatoria.nombre}</Text>
            <View className="flex-row items-center mt-3">
              <Badge label={postulacion.estado} variant="info" className="mr-3" />
              {!estaVigente && (
                <Badge label="INACTIVA" variant="error" className="mr-3" />
              )}
            </View>
            
            {postulacion.motivo_rechazo && (postulacion.estado === 'CON_OBSERVACIONES' || postulacion.estado === 'DESESTIMADO') && (
              <View className="mt-4 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl">
                <Text className="text-amber-400 font-bold mb-1 text-sm uppercase tracking-wider">Comentario de Revisión:</Text>
                <Text className="text-amber-400/90 text-sm leading-relaxed">{postulacion.motivo_rechazo}</Text>
              </View>
            )}
            <View className="mt-6 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-zinc-300 font-semibold text-sm">Progreso de Documentos Obligatorios</Text>
                <Text className="text-purple-400 font-bold">{postulacion.progreso_porcentaje}%</Text>
              </View>
              <View className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                <View style={{ width: `${postulacion.progreso_porcentaje}%` }} className="bg-purple-500 h-full" />
              </View>
              <Text className="text-zinc-500 text-xs mt-2 font-medium">
                {postulacion.documentos_obligatorios_completos} de {postulacion.documentos_obligatorios_total} completados
              </Text>
            </View>
          </View>

          <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Requisitos</Text>

          {postulacion.requisitos.map((req: any) => (
            <Card key={req.id_requisito} className="mb-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-zinc-50 font-bold text-base">{req.nombre}</Text>
                  <Text className="text-zinc-500 text-xs mt-1 uppercase tracking-wider">
                    {req.codigo} · {req.obligatorio ? 'Obligatorio' : 'Opcional'}
                  </Text>
                </View>
                {req.documento_subido && req.estado_validacion && (
                  <Badge
                    label={req.estado_validacion}
                    variant={
                      (req.estado_validacion === 'APROBADA' || req.estado_validacion === 'ACEPTADA')
                        ? 'success'
                        : req.estado_validacion === 'RECHAZADA'
                        ? 'error'
                        : 'info'
                    }
                  />
                )}
              </View>
              {renderUploadButton(req)}
              {req.documento_subido && req.estado_validacion === 'RECHAZADA' && req.comentario_observacion && (
                <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mt-4 flex-row items-start">
                  <AntDesign name="exclamationcircleo" size={16} color="#ef4444" style={{ marginTop: 2, marginRight: 8 }} />
                  <View className="flex-1">
                    <Text className="text-red-400 font-bold text-xs uppercase tracking-wider">Observación del Administrador:</Text>
                    <Text className="text-red-300 text-sm mt-1 leading-relaxed">{req.comentario_observacion}</Text>
                  </View>
                </View>
              )}
            </Card>
          ))}


          {errorEnvio.length > 0 && (
            <View className="mb-6 bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
              <Text className="text-red-400 font-bold mb-2">Faltan documentos obligatorios:</Text>
              {errorEnvio.map((err, idx) => (
                <Text key={idx} className="text-red-400/80 text-xs mb-1">• {err.codigo} - {err.nombre}</Text>
              ))}
            </View>
          )}

          {esEditable && estaVigente && (
            <View className="mt-4 border-t border-zinc-800 pt-6 pb-12">
              <Button
                label="Finalizar y Enviar Postulación"
                onPress={handleEnviar}
                loading={isSending}
              />
              <Text className="text-zinc-500 text-xs text-center mt-3 font-medium">Al enviar, tu expediente pasará a revisión y ya no podrás modificarlo.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
