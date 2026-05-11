import { SafeAreaView, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { useMisPostulacionesQuery } from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'expo-router';
import { Header } from '@/components/ui/Header';

export default function MisPostulacionesScreen() {
  const { data, isLoading, isError } = useMisPostulacionesQuery();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface-50">
      <Header title="Mis Postulaciones" showBack={false} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">
          <View className="mb-8">
            <Text className="text-4xl font-extrabold text-surface-900 tracking-tight">Mis Postulaciones</Text>
            <Text className="text-base text-surface-500 mt-2 font-medium">Sigue el progreso de tus aplicaciones.</Text>
          </View>

          {isLoading && (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator color="#3b82f6" size="large" />
            </View>
          )}

          {isError && (
            <View className="flex-1 justify-center items-center bg-red-50 p-6 rounded-2xl border border-red-100">
              <Text className="text-red-600 font-semibold text-center mb-1">Error al cargar</Text>
            </View>
          )}

          {!isLoading && !isError && (
            <View>
              {(!data?.items || data.items.length === 0) ? (
                <View className="items-center justify-center py-20">
                  <Text className="text-surface-400 font-semibold text-lg">No tienes postulaciones activas</Text>
                </View>
              ) : (
                data.items.map((post: any) => (
                  <Card key={post.id_postulacion} className="mb-4">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-surface-900 font-bold text-lg flex-1 mr-2">{post.convocatoria.nombre}</Text>
                      <Badge label={post.estado} variant="info" />
                    </View>
                    
                    <View className="flex-row items-center justify-between mb-4 mt-2">
                      <Text className="text-surface-500 text-sm font-medium">Documentos subidos:</Text>
                      <Text className="text-brand-600 font-bold text-sm bg-brand-50 px-3 py-1 rounded-full">
                        {post.documentos_completos} / {post.documentos_total}
                      </Text>
                    </View>

                    <Button 
                      label="Gestionar Documentos" 
                      variant="outline"
                      onPress={() => router.push(`/(tabs)/mis-postulaciones/${post.id_postulacion}`)}
                    />
                  </Card>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
