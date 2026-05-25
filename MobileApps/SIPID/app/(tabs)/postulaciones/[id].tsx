import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Linking, TextInput, Platform } from 'react-native';
import {
  usePostulacionDetalleAdminQuery,
  useCambiarEstadoAdminMutation,
  useValidarDocumentoMutation,
  useExpedienteHistorialQuery,
  useEmitirDictamenFinalMutation
} from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { apiClient } from '@/config/api';

function TimelineItem({ item }: { item: any }) {
  const isDocValidation = item.tipo === 'VALIDACION_DOCUMENTO';
  const dateStr = new Date(item.creado_en).toLocaleString('es-MX', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <View className="flex-row items-stretch mb-4 gap-4">
      <View className="flex-col items-center">
        <View className={`w-8 h-8 rounded-full items-center justify-center border ${
          isDocValidation
            ? (item.estado_nuevo === 'APROBADA' || item.estado_nuevo === 'ACEPTADA')
              ? 'bg-emerald-500/20 border-emerald-500/40'
              : 'bg-red-500/20 border-red-500/40'
            : 'bg-purple-500/20 border-purple-500/40'
        }`}>
          {isDocValidation ? (
            (item.estado_nuevo === 'APROBADA' || item.estado_nuevo === 'ACEPTADA') ? (
              <AntDesign name="checkcircleo" size={14} color="#34d399" />
            ) : (
              <AntDesign name="closecircleo" size={14} color="#f87171" />
            )
          ) : (
            <AntDesign name="infocircleo" size={14} color="#c084fc" />
          )}
        </View>
        <View className="w-[2px] flex-grow bg-zinc-800 mt-2" />
      </View>

      <View className="flex-1 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
        <View className="flex-row items-center justify-between mb-2 gap-2">
          <Text className="text-zinc-50 font-bold text-sm">
            {isDocValidation ? 'Validación de Documento' : 'Cambio de Estado'}
          </Text>
          <Text className="text-zinc-500 text-xs font-semibold">{dateStr}</Text>
        </View>

        <Text className="text-zinc-300 text-sm font-semibold mb-1">
          {isDocValidation ? (
            <>
              Requisito: <Text className="text-purple-400">{item.nombre_requisito} ({item.codigo_requisito})</Text>
            </>
          ) : (
            <>
              Transición: <Text className="text-zinc-400">{item.estado_anterior}</Text> → <Text className="text-purple-400">{item.estado_nuevo}</Text>
            </>
          )}
        </Text>

        {isDocValidation && (
          <Text className="text-zinc-400 text-xs font-medium mb-1">
            Fallo: <Text className={item.estado_nuevo === 'APROBADA' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{item.estado_nuevo}</Text>
          </Text>
        )}

        {item.comentario && (
          <View className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl mt-2">
            <Text className="text-zinc-400 text-xs italic">"{item.comentario}"</Text>
          </View>
        )}

        {item.actor_correo && (
          <Text className="text-zinc-500 text-xs mt-2 text-right">Usuario: {item.actor_correo}</Text>
        )}
      </View>
    </View>
  );
}

export default function PostulacionDetalleAdminScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Queries & Mutations
  const { data: post, isLoading, isError } = usePostulacionDetalleAdminQuery(id as string);
  const { data: historialData, isLoading: loadingHistorial } = useExpedienteHistorialQuery(id as string);
  
  const { mutateAsync: cambiarEstado, isPending: isChangingState } = useCambiarEstadoAdminMutation();
  const { mutateAsync: validarDocumento, isPending: isValidatingDoc } = useValidarDocumentoMutation();
  const { mutateAsync: emitirDictamen, isPending: isSubmittingDictamen } = useEmitirDictamenFinalMutation();

  // Component States
  const [actionType, setActionType] = useState<'OBSERVACIONES' | 'DESESTIMAR' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [docRejectionComment, setDocRejectionComment] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const expedienteEstaCerrado = post?.estado === 'ACEPTADO' || post?.estado === 'DESESTIMADO';

  const handleAction = async (estado: string) => {
    if (estado === 'CON_OBSERVACIONES' && !motivo.trim()) {
      alert('Debes ingresar un motivo o justificación');
      return;
    }
    try {
      await cambiarEstado({ idPostulacion: id as string, estado, motivo: motivo.trim() || undefined });
      alert('Estado actualizado con éxito');
      setActionType(null);
      setMotivo('');
    } catch (err: any) {
      alert('Error al actualizar estado: ' + (err.response?.data?.detail || ''));
    }
  };

  const handleDictamenFinal = async (fallo: 'ACEPTADO' | 'DESESTIMADO') => {
    if (fallo === 'DESESTIMADO' && !motivo.trim()) {
      alert('Debes ingresar el motivo de desestimación');
      return;
    }
    const confirmacion = confirm(`¿Estás seguro de emitir el dictamen como ${fallo}? Esta acción BLOQUEARÁ permanentemente el expediente.`);
    if (!confirmacion) return;

    try {
      await emitirDictamen({ idPostulacion: id as string, fallo, motivo: motivo.trim() || undefined });
      alert('Dictamen final emitido con éxito. El expediente ha sido congelado.');
      setActionType(null);
      setMotivo('');
    } catch (err: any) {
      alert('Error al emitir dictamen final: ' + (err.response?.data?.detail || ''));
    }
  };

  const handleDocumentValidation = async (idDoc: string, decision: 'ACEPTADA' | 'RECHAZADA') => {
    if (decision === 'RECHAZADA') {
      if (!docRejectionComment.trim()) {
        alert('El comentario de rechazo es obligatorio');
        return;
      }
      if (docRejectionComment.trim().length > 500) {
        alert('El comentario no puede exceder los 500 caracteres');
        return;
      }
    }

    try {
      await validarDocumento({
        idPostulacion: id as string,
        idPostulacionDocumento: idDoc,
        decision,
        comentario: decision === 'RECHAZADA' ? docRejectionComment.trim() : undefined,
      });
      alert(decision === 'ACEPTADA' ? 'Documento aprobado ✅' : 'Documento rechazado ❌');
      setRejectingDocId(null);
      setDocRejectionComment('');
    } catch (err: any) {
      alert('Error al validar documento: ' + (err.response?.data?.detail || ''));
    }
  };

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      if (Platform.OS === 'web') {
        const response = await apiClient.get(`/admin/postulaciones/${id}/export.zip`, {
          responseType: 'blob'
        });
        const blob = new Blob([response.data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expediente_${post?.usuario.correo || id}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('La exportación en ZIP requiere el uso de la plataforma web.');
      }
    } catch (err: any) {
      alert('Error al descargar ZIP: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-zinc-950">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </View>
    );
  }

  if (isError || !post) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950">
        <Header title="Detalle" showHub={true} />
        <View className="flex-1 p-4 md:p-8">
          <View className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl mb-6">
            <Text className="text-red-400 font-semibold text-center">Error al cargar detalles de la postulación</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-zinc-950">
      <Header title="Detalle de Aspirante" showHub={true} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">
          
          {/* Locked / Frozen Banner */}
          {expedienteEstaCerrado && (
            <View className="bg-red-500/10 border border-red-500/30 p-5 rounded-3xl mb-8 flex-row items-center space-x-3">
              <AntDesign name="lock" size={24} color="#f87171" className="mr-2" />
              <View className="flex-1">
                <Text className="text-red-400 font-bold text-base">Expediente Cerrado y Bloqueado</Text>
                <Text className="text-red-400/80 text-sm font-medium mt-1">Este expediente se encuentra en su estado final de Dictamen y no se permite ninguna alteración posterior.</Text>
              </View>
            </View>
          )}

          {/* Core Info Bar */}
          <View className="mb-8 flex-row flex-wrap justify-between items-start gap-4">
            <View className="flex-1 min-w-[280px]">
              <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Aspirante</Text>
              <Text className="text-3xl font-bold text-zinc-50 tracking-tight">{post.usuario.correo}</Text>
              <Text className="text-base text-zinc-400 mt-2 font-medium">Postulación a: {post.nombre_convocatoria}</Text>
              <View className="flex-row items-center mt-3">
                <Badge label={post.estado} variant={post.estado === 'ACEPTADO' ? 'success' : post.estado === 'DESESTIMADO' ? 'error' : 'info'} className="mr-3" />
              </View>
            </View>

            {/* Export ZIP Action Button */}
            <View className="self-end md:self-start">
              <Button
                label={isExporting ? "Generando ZIP..." : "Descargar Expediente ZIP"}
                icon={<AntDesign name="export" size={16} color="#ffffff" />}
                variant="primary"
                onPress={handleDownloadZip}
                loading={isExporting}
              />
            </View>
          </View>

          <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Documentos Subidos</Text>

          <View className="mb-8">
            {(!post.documentos || post.documentos.length === 0) ? (
              <View className="items-center justify-center py-16 bg-zinc-900 rounded-2xl border border-zinc-800">
                <Text className="text-zinc-500 font-semibold text-base">No ha subido ningún documento aún</Text>
              </View>
            ) : (
              post.documentos.map((doc: any) => {
                const docValidated = doc.estado_validacion === 'APROBADA' || doc.estado_validacion === 'ACEPTADA' || doc.estado_validacion === 'RECHAZADA';
                
                return (
                  <Card key={doc.id_requisito} className="mb-4">
                    <View className="flex-row items-start justify-between flex-wrap gap-2">
                      <View className="flex-1 pr-4">
                        <Text className="text-zinc-50 font-bold text-base">{doc.nombre}</Text>
                        <Text className="text-zinc-500 text-xs mt-1 uppercase tracking-wider">{doc.codigo}</Text>
                      </View>
                      {doc.estado_validacion && (
                        <Badge
                          label={doc.estado_validacion}
                          variant={
                            (doc.estado_validacion === 'APROBADA' || doc.estado_validacion === 'ACEPTADA')
                              ? 'success'
                              : doc.estado_validacion === 'RECHAZADA'
                              ? 'error'
                              : 'info'
                          }
                        />
                      )}
                    </View>

                    <View className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl mt-3 flex-row items-center justify-between">
                      <View className="flex-1 mr-3">
                        <Text className="text-zinc-200 font-medium text-sm" numberOfLines={1}>{doc.nombre_original}</Text>
                        <Text className="text-zinc-500 text-xs mt-0.5">
                          {(doc.tamano_bytes / 1024).toFixed(1)} KB · {new Date(doc.subido_en).toLocaleDateString()}
                        </Text>
                      </View>
                      <Button
                        icon={<AntDesign name="eye" size={16} color="#ffffff" />}
                        variant="outline"
                        label="Ver"
                        onPress={() => Linking.openURL(doc.presigned_download_url)}
                      />
                    </View>

                    {/* RF-15 Approval/Rejection Actions per Document */}
                    {post.estado === 'EN_REVISION' && !expedienteEstaCerrado && (
                      <View className="mt-4 pt-3 border-t border-zinc-800/80">
                        {rejectingDocId !== doc.id_postulacion_documento ? (
                          <View className="flex-row justify-end gap-3">
                            <Button
                              label="Aprobar"
                              variant="glass"
                              onPress={() => handleDocumentValidation(doc.id_postulacion_documento, 'ACEPTADA')}
                              disabled={isValidatingDoc}
                            />
                            <Button
                              label="Rechazar"
                              variant="outline"
                              onPress={() => {
                                setRejectingDocId(doc.id_postulacion_documento);
                                setDocRejectionComment('');
                              }}
                              disabled={isValidatingDoc}
                            />
                          </View>
                        ) : (
                          <View className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl mt-1">
                            <Text className="text-zinc-200 font-bold mb-2 text-xs uppercase tracking-wider">Capturar Observación de Rechazo (máx. 500 carac.):</Text>
                            <TextInput
                              className="bg-zinc-900 border border-zinc-800 text-zinc-100 p-3 rounded-xl mb-3 text-sm"
                              multiline
                              numberOfLines={3}
                              placeholder="Escribe la razón detallada del rechazo..."
                              placeholderTextColor="#52525b"
                              value={docRejectionComment}
                              onChangeText={setDocRejectionComment}
                              maxLength={500}
                            />
                            <View className="flex-row justify-end gap-3">
                              <Button
                                label="Cancelar"
                                variant="outline"
                                onPress={() => setRejectingDocId(null)}
                                disabled={isValidatingDoc}
                              />
                              <Button
                                label="Confirmar Rechazo"
                                onPress={() => handleDocumentValidation(doc.id_postulacion_documento, 'RECHAZADA')}
                                loading={isValidatingDoc}
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Render existing observation comments for Admin reference */}
                    {doc.comentario_observacion && (
                      <View className="bg-red-500/5 border border-red-500/15 p-3 rounded-xl mt-3 flex-row items-start">
                        <AntDesign name="exclamationcircleo" size={14} color="#f87171" style={{ marginTop: 2, marginRight: 6 }} />
                        <View className="flex-1">
                          <Text className="text-red-400 font-bold text-xs uppercase tracking-wider">Comentario Registrado:</Text>
                          <Text className="text-zinc-300 text-xs mt-1">{doc.comentario_observacion}</Text>
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>

          {/* Global Expediente Revision Workflow */}
          {!expedienteEstaCerrado && post.estado === 'ENVIADO' && (
            <View className="mt-8 border-t border-zinc-800 pt-6">
              <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Acciones de Revisión</Text>
              <Button
                label="Iniciar Revisión de Expediente"
                onPress={() => handleAction('EN_REVISION')}
                loading={isChangingState}
              />
            </View>
          )}

          {!expedienteEstaCerrado && post.estado === 'EN_REVISION' && (
            <View className="mt-8 border-t border-zinc-800 pt-6 pb-8">
              <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Dictamen de Revisión</Text>

              {!actionType ? (
                <View className="flex-col gap-3">
                  <Button
                    label="Aceptar Expediente (Dictamen Final)"
                    onPress={() => handleDictamenFinal('ACEPTADO')}
                    loading={isSubmittingDictamen}
                  />
                  <Button
                    label="Devolver con Observaciones"
                    onPress={() => setActionType('OBSERVACIONES')}
                    variant="outline"
                  />
                  <Button
                    label="Desestimar Postulación (Dictamen Final)"
                    onPress={() => setActionType('DESESTIMAR')}
                    variant="outline"
                  />
                </View>
              ) : (
                <View className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                  <Text className="text-zinc-50 font-bold mb-2">
                    {actionType === 'OBSERVACIONES' ? 'Ingresa las observaciones para devolver:' : 'Ingresa el motivo de desestimación:'}
                  </Text>
                  <TextInput
                    className="bg-zinc-950 border border-zinc-800 text-zinc-100 p-4 rounded-xl mb-4 text-base"
                    multiline
                    numberOfLines={4}
                    placeholder="Escribe aquí los detalles..."
                    placeholderTextColor="#52525b"
                    value={motivo}
                    onChangeText={setMotivo}
                    editable={!isChangingState && !isSubmittingDictamen}
                  />
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        label="Cancelar"
                        onPress={() => { setActionType(null); setMotivo(''); }}
                        variant="outline"
                        disabled={isChangingState || isSubmittingDictamen}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Confirmar"
                        onPress={() => {
                          if (actionType === 'OBSERVACIONES') {
                            handleAction('CON_OBSERVACIONES');
                          } else {
                            handleDictamenFinal('DESESTIMADO');
                          }
                        }}
                        loading={isChangingState || isSubmittingDictamen}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* RF-16 Chronological Visual Log (Timeline) */}
          <View className="mt-8 border-t border-zinc-800 pt-8">
            <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">Historial de Validaciones y Cambios</Text>
            
            {loadingHistorial ? (
              <ActivityIndicator color="#8b5cf6" size="small" />
            ) : (!historialData?.items || historialData.items.length === 0) ? (
              <View className="py-8 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 items-center justify-center">
                <Text className="text-zinc-500 text-sm font-medium">No se han registrado eventos o cambios aún</Text>
              </View>
            ) : (
              <View className="flex-col">
                {historialData.items.map((item: any, idx: number) => (
                  <TimelineItem key={idx} item={item} />
                ))}
              </View>
            )}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
