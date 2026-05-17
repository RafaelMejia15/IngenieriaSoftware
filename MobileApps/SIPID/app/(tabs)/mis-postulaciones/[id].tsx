import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Platform, Pressable } from 'react-native';
import { useMisPostulacionesQuery, useSubirDocumentoMutation } from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { useState } from 'react';

export default function MisPostulacionesDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data, isLoading } = useMisPostulacionesQuery();
  const { mutateAsync: subirArchivo, isPending } = useSubirDocumentoMutation();
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});

  const postulacion = data?.items.find((p: any) => p.id_postulacion === id);

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
    } catch (err) {
      alert('Error al subir archivo');
    }
  };

  const renderUploadButton = (req: any) => {
    if (req.documento_subido) {
      return (
        <View className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl mt-3 flex-row items-center justify-between">
          <View>
            <Text className="text-emerald-400 font-medium text-sm">Archivo subido</Text>
            <Text className="text-emerald-400/70 text-xs mt-0.5">{req.nombre_archivo_subido}</Text>
          </View>
          <Badge label="Completado" variant="success" />
        </View>
      );
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
            disabled={isPending}
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
          <View className="mb-8">
            <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">Postulación</Text>
            <Text className="text-3xl font-bold text-zinc-50 tracking-tight">{postulacion.convocatoria.nombre}</Text>
            <View className="flex-row items-center mt-3">
              <Badge label={postulacion.estado} variant="info" className="mr-3" />
              <Text className="text-zinc-500 font-medium text-sm">
                Progreso: {postulacion.documentos_completos}/{postulacion.documentos_total} docs
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
              </View>
              {renderUploadButton(req)}
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
