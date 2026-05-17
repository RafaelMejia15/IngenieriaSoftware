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
    <SafeAreaView className="flex-1 bg-zinc-950">
      <Header title="Mis Postulaciones" showBack={false} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">

          <View className="mb-8">
            <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">
              Mi Actividad
            </Text>
            <Text className="text-4xl font-bold text-zinc-50 tracking-tight">Mis Postulaciones</Text>
            <Text className="text-base text-zinc-400 mt-2 font-medium">Sigue el progreso de tus aplicaciones.</Text>
          </View>

          {isLoading && (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator color="#8b5cf6" size="large" />
              <Text className="text-zinc-500 font-bold text-xs mt-4 tracking-widest uppercase">Cargando...</Text>
            </View>
          )}

          {isError && (
            <View className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl items-center">
              <Text className="text-red-400 font-semibold text-center">Error al cargar tus postulaciones</Text>
            </View>
          )}

          {!isLoading && !isError && (
            <View>
              {(!data?.items || data.items.length === 0) ? (
                <View className="items-center justify-center py-24 bg-zinc-900 border border-zinc-800 rounded-3xl border-dashed">
                  <Text className="text-4xl mb-4">📭</Text>
                  <Text className="text-zinc-400 font-semibold text-lg">No tienes postulaciones activas</Text>
                </View>
              ) : (
                data.items.map((post: any) => (
                  <Card key={post.id_postulacion} className="mb-4">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-zinc-50 font-bold text-lg flex-1 mr-2 tracking-tight">{post.convocatoria.nombre}</Text>
                      <Badge label={post.estado} variant="info" />
                    </View>

                    <View className="flex-row items-center justify-between mb-4 mt-3">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Documentos subidos</Text>
                      <Text className="text-purple-400 font-bold text-sm bg-purple-600/15 border border-purple-500/30 px-3 py-1 rounded-full">
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
