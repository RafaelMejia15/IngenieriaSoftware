import { useConvocatoriasActivasQuery, useConvocatoriasAdminQuery } from '@/features/vacantes/api/vacantesQueries';
import { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'expo-router';
import { Header } from '@/components/ui/Header';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  Platform
} from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePostularMutation } from '@/features/postulaciones/api/postulacionesHooks';
import AntDesign from '@expo/vector-icons/AntDesign'

function ConvocatoriaCard({ item, isAdmin }: { item: any; isAdmin: boolean }) {
  const router = useRouter();
  const inicio = new Date(item.fecha_inicio).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' });
  const fin = new Date(item.fecha_fin).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' });
  const { mutateAsync: postularAction, isPending } = usePostularMutation();

  const handlePostular = async () => {
    try {
      await postularAction(item.id);
      router.push('/(tabs)/mis-postulaciones');
    } catch (e) {
      console.error(e);
      alert('Error al postularse');
    }
  };

  return (
    <View className="w-full md:w-[48%] bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-purple-500/30 hover:bg-zinc-800/60 transition-all mb-6 flex-col">
      <View className="flex-row items-start justify-between mb-5 gap-4">
        <Text className="text-zinc-50 font-bold text-xl flex-1 leading-tight tracking-tight">{item.nombre}</Text>
        <Badge label={item.estado} variant={item.estado === 'ABIERTA' ? 'info' : 'default'} />
      </View>

      <View className="flex-row items-center mb-6 bg-zinc-950 border border-zinc-800 p-3 rounded-xl self-start">
        <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Vigencia:</Text>
        <Text className="text-zinc-300 text-sm font-semibold ml-2">{inicio} — {fin}</Text>
      </View>

      <View className="mb-8 flex-1">
        <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-3">Requisitos Obligatorios</Text>
        <View className="gap-2">
          {item.requisitos_obligatorios.map((req: any) => (
            <View key={req.id} className="flex-row items-center gap-3">
              <View className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
              <Text className="text-zinc-400 text-sm font-medium flex-1">{req.nombre}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-auto pt-5 border-t border-zinc-800">
        {isAdmin ? (
          <Button label="Ver Postulantes" variant="outline" onPress={() => router.push(`/(tabs)/convocatorias/${item.id}/postulantes` as any)} />
        ) : (
          item.ya_postulo ? (
            <Button label="Ver mi postulación" variant="glass" onPress={() => router.push(`/(tabs)/mis-postulaciones/${item.id_postulacion}` as any)} />
          ) : (
            <Button label="Postularme" variant="primary" loading={isPending} onPress={handlePostular} />
          )
        )}
      </View>
    </View>
  );
}

export default function ConvocatoriasScreen() {
  const [query, setQuery] = useState('');
  const { user } = useAuthStore();
  const isAdmin = user?.rol?.toLowerCase() === 'admin' || user?.rol?.toLowerCase() === 'administrador';

  const { data: dataActivas, isLoading: loadingActivas, isError: errorActivas } = useConvocatoriasActivasQuery(isAdmin ? undefined : query || undefined, !isAdmin);
  const { data: dataAdmin, isLoading: loadingAdmin, isError: errorAdmin } = useConvocatoriasAdminQuery(isAdmin ? query || undefined : undefined, isAdmin);

  const data = isAdmin ? dataAdmin : dataActivas;
  const isLoading = isAdmin ? loadingAdmin : loadingActivas;
  const isError = isAdmin ? errorAdmin : errorActivas;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-zinc-950">
      <Header title="Convocatorias" showBack={false} />
      <ScrollView style={{ flex: 1 }} className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
        <View className="w-full max-w-5xl mx-auto px-6 py-8 md:py-12 flex-grow">

          <View className="mb-8">
            <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">
              {isAdmin ? 'Administración' : 'Vacantes Disponibles'}
            </Text>
            <Text className="text-4xl md:text-5xl font-bold text-zinc-50 tracking-tight mb-2">Convocatorias</Text>
            <Text className="text-base text-zinc-400 font-medium">Explora las vacantes disponibles, revisa sus requisitos y postúlate.</Text>
          </View>

          <View className="flex-row space-x-2 items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-2 mb-10">
            <AntDesign name="search" size={20} color="#52525b" />
            <TextInput
              className="flex-1 text-zinc-50 py-3 text-base font-medium"
              placeholder="Buscar convocatoria por nombre..."
              placeholderTextColor="#52525b"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={Platform.OS === 'web' ? { outline: 'none', color: '#fafafa' } as any : {}}
            />
          </View>

          {isLoading && (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator color="#8b5cf6" size="large" />
              <Text className="text-zinc-500 font-bold text-xs mt-4 tracking-widest uppercase">Cargando vacantes...</Text>
            </View>
          )}

          {isError && (
            <View className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl my-10 items-center">
              <Text className="text-red-400 font-bold text-lg mb-1">Error de conexión</Text>
              <Text className="text-red-400/70 text-sm text-center">No se pudieron cargar las convocatorias. Por favor, intenta de nuevo.</Text>
            </View>
          )}

          {!isLoading && !isError && (
            <View>
              {data?.items.length === 0 ? (
                <View className="items-center justify-center py-24 bg-zinc-900 border border-zinc-800 rounded-3xl border-dashed">
                  <Text className="text-4xl mb-4">📭</Text>
                  <Text className="text-zinc-50 font-bold text-xl mb-2">No hay vacantes activas</Text>
                  <Text className="text-zinc-500 text-sm text-center max-w-sm">
                    Actualmente no hay convocatorias que coincidan con tu búsqueda.
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap justify-between">
                  {data?.items.map((item: any) => (
                    <ConvocatoriaCard key={item.id} item={item} isAdmin={isAdmin} />
                  ))}
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}