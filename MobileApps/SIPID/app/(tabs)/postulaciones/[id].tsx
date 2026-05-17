import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Linking, TextInput } from 'react-native';
import { usePostulacionDetalleAdminQuery, useCambiarEstadoAdminMutation } from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState } from 'react';

export default function PostulacionDetalleAdminScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data: post, isLoading, isError } = usePostulacionDetalleAdminQuery(id as string);
  const { mutateAsync: cambiarEstado, isPending: isChangingState } = useCambiarEstadoAdminMutation();
  const [actionType, setActionType] = useState<'OBSERVACIONES' | 'DESESTIMAR' | null>(null);
  const [motivo, setMotivo] = useState('');

  const handleAction = async (estado: string) => {
    if ((estado === 'CON_OBSERVACIONES' || estado === 'DESESTIMADO') && !motivo.trim()) {
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
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">
          <View className="mb-8">
            <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">Aspirante</Text>
            <Text className="text-3xl font-bold text-zinc-50 tracking-tight">{post.usuario.correo}</Text>
            <Text className="text-base text-zinc-400 mt-2 font-medium">Postulación a: {post.nombre_convocatoria}</Text>
            <View className="flex-row items-center mt-3">
              <Badge label={post.estado} variant="info" className="mr-3" />
            </View>
          </View>

          <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Documentos Subidos</Text>

          <View>
            {(!post.documentos || post.documentos.length === 0) ? (
              <View className="items-center justify-center py-16 bg-zinc-900 rounded-2xl border border-zinc-800">
                <Text className="text-zinc-500 font-semibold text-base">No ha subido ningún documento aún</Text>
              </View>
            ) : (
              post.documentos.map((doc: any) => (
                <Card key={doc.id_requisito} className="mb-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-zinc-50 font-bold text-base">{doc.nombre}</Text>
                      <Text className="text-zinc-500 text-xs mt-1 uppercase tracking-wider">{doc.codigo}</Text>
                    </View>
                  </View>

                  <View className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl mt-3 flex-row items-center justify-between">
                    <View>
                      <Text className="text-zinc-200 font-medium text-sm">{doc.nombre_original}</Text>
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
                </Card>
              ))
            )}
          </View>

          {post.estado === 'ENVIADO' && (
            <View className="mt-8 border-t border-zinc-800 pt-6">
              <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Acciones de Revisión</Text>
              <Button
                label="Iniciar Revisión de Expediente"
                onPress={() => handleAction('EN_REVISION')}
                loading={isChangingState}
              />
            </View>
          )}

          {post.estado === 'EN_REVISION' && (
            <View className="mt-8 border-t border-zinc-800 pt-6 pb-8">
              <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Dictamen de Revisión</Text>

              {!actionType ? (
                <View className="flex-col gap-3">
                  <Button
                    label="Aceptar Expediente"
                    onPress={() => handleAction('ACEPTADO')}
                    loading={isChangingState}
                  />
                  <Button
                    label="Devolver con Observaciones"
                    onPress={() => setActionType('OBSERVACIONES')}
                    variant="outline"
                  />
                  <Button
                    label="Desestimar Postulación"
                    onPress={() => setActionType('DESESTIMAR')}
                    variant="outline"
                  />
                </View>
              ) : (
                <View className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                  <Text className="text-zinc-50 font-bold mb-2">
                    {actionType === 'OBSERVACIONES' ? 'Ingresa las observaciones:' : 'Ingresa el motivo de desestimación:'}
                  </Text>
                  <TextInput
                    className="bg-zinc-950 border border-zinc-800 text-zinc-100 p-4 rounded-xl mb-4 text-base"
                    multiline
                    numberOfLines={4}
                    placeholder="Escribe aquí los detalles..."
                    placeholderTextColor="#52525b"
                    value={motivo}
                    onChangeText={setMotivo}
                    editable={!isChangingState}
                  />
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        label="Cancelar"
                        onPress={() => { setActionType(null); setMotivo(''); }}
                        variant="outline"
                        disabled={isChangingState}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Confirmar"
                        onPress={() => handleAction(actionType === 'OBSERVACIONES' ? 'CON_OBSERVACIONES' : 'DESESTIMADO')}
                        loading={isChangingState}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
