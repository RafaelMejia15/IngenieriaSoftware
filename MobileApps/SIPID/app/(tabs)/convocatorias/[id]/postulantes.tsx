import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Platform } from 'react-native';
import { usePostulacionesAdminQuery } from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState } from 'react';
import { apiClient } from '@/config/api';

export default function PostulantesConvocatoriaScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data, isLoading, isError } = usePostulacionesAdminQuery(id as string);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      if (Platform.OS === 'web') {
        const response = await apiClient.get(`/admin/convocatorias/${id}/postulaciones/export.csv`, {
          responseType: 'blob'
        });
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `postulantes_convocatoria_${id}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('La exportación de reportes requiere el uso de la plataforma web.');
      }
    } catch (err: any) {
      alert('Error al exportar CSV: ' + (err.response?.data?.detail || err.message));
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

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-zinc-950">
      <Header title="Postulantes" showHub={true} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">
          
          {/* Header Row with Export Option */}
          <View className="flex-row flex-wrap justify-between items-center mb-8 gap-4">
            <View className="flex-1 min-w-[200px]">
              <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Administración</Text>
              <Text className="text-3xl font-bold text-zinc-50 tracking-tight">Postulantes</Text>
              <Text className="text-sm text-zinc-400 mt-2 font-medium">Revisa las aplicaciones para esta vacante.</Text>
            </View>

            {data?.items && data.items.length > 0 && (
              <Button
                label={isExporting ? "Exportando..." : "Exportar Lista (.csv)"}
                icon={<AntDesign name="download" size={16} color="#ffffff" />}
                variant="primary"
                onPress={handleExportCSV}
                loading={isExporting}
              />
            )}
          </View>

          {isError && (
            <View className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl mb-6">
              <Text className="text-red-400 font-semibold text-center">Error al cargar postulantes</Text>
            </View>
          )}

          <View>
            {(!data?.items || data.items.length === 0) ? (
              <View className="items-center justify-center py-20 bg-zinc-900 border border-zinc-800 rounded-3xl border-dashed">
                <Text className="text-4xl mb-4">📭</Text>
                <Text className="text-zinc-50 font-bold text-xl mb-1">No hay postulantes aún</Text>
                <Text className="text-zinc-500 text-sm text-center">Nadie se ha postulado a esta convocatoria todavía.</Text>
              </View>
            ) : (
              data.items.map((post: any) => (
                <Card key={post.id_postulacion} className="mb-4">
                  <View className="flex-row items-start justify-between mb-3 gap-2">
                    <Text className="text-zinc-50 font-bold text-lg flex-1 mr-2">{post.usuario.correo}</Text>
                    <Badge
                      label={post.estado}
                      variant={
                        post.estado === 'ACEPTADO'
                          ? 'success'
                          : post.estado === 'DESESTIMADO'
                          ? 'error'
                          : 'info'
                      }
                    />
                  </View>

                  <View className="flex-row items-center justify-between mb-5 mt-2 bg-zinc-950 border border-zinc-800/80 p-3 rounded-xl">
                    <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Progreso de Carga:</Text>
                    <Text className="text-purple-400 font-bold text-sm bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                      {post.documentos_completos} / {post.documentos_total} docs
                    </Text>
                  </View>

                  <Button
                    label="Ver Detalles y Archivos"
                    variant="outline"
                    onPress={() => router.push(`/(tabs)/postulaciones/${post.id_postulacion}` as any)}
                  />
                </Card>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
