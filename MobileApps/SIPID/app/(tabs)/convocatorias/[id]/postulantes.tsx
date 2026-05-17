import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Pressable } from 'react-native';
import { usePostulacionesAdminQuery } from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';

export default function PostulantesConvocatoriaScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data, isLoading, isError } = usePostulacionesAdminQuery(id as string);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface-50">
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-50">
      <Header title="Postulantes" showHub={true} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">
          <View className="mb-8">
            <Text className="text-3xl font-extrabold text-surface-900 tracking-tight">Postulantes</Text>
            <Text className="text-base text-surface-500 mt-2 font-medium">Revisa las aplicaciones para esta vacante.</Text>
          </View>

          {isError && (
            <View className="bg-red-50 p-6 rounded-2xl border border-red-100 mb-6">
              <Text className="text-red-600 font-semibold text-center">Error al cargar postulantes</Text>
            </View>
          )}

          <View>
            {(!data?.items || data.items.length === 0) ? (
              <View className="items-center justify-center py-20">
                <Text className="text-surface-400 font-semibold text-lg">No hay postulantes aún</Text>
              </View>
            ) : (
              data.items.map((post: any) => (
                <Card key={post.id_postulacion} className="mb-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="text-surface-900 font-bold text-lg flex-1 mr-2">{post.usuario.correo}</Text>
                  </View>
                  <Badge label={post.estado} variant="info" />

                  <View className="flex-row items-center justify-between mb-4 mt-2">
                    <Text className="text-surface-500 text-sm font-medium">Progreso:</Text>
                    <Text className="text-brand-600 font-bold text-sm bg-brand-50 px-3 py-1 rounded-full">
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
