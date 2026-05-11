import { useConvocatoriasActivasQuery, useConvocatoriasAdminQuery } from '@/features/vacantes/api/vacantesQueries';
import { ConvocatoriaParaAspiranteResponse } from '@/types/vacantes.types';
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
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePostularMutation } from '@/features/postulaciones/api/postulacionesHooks';

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
    <Card className="mb-4">
      <View className="flex-row items-start justify-between mb-3 gap-2">
        <Text className="text-surface-900 font-bold text-lg flex-1 leading-tight">{item.nombre}</Text>
        <Badge
          label={item.estado}
          variant={item.estado === 'ABIERTA' ? 'info' : 'default'}
        />
      </View>

      <View className="flex-row items-center mb-4 bg-surface-50 p-2 rounded-lg self-start">
        <Text className="text-surface-500 text-xs font-medium uppercase tracking-wider">Vigencia:</Text>
        <Text className="text-surface-700 text-xs font-semibold ml-2">
          {inicio} — {fin}
        </Text>
      </View>

      <Text className="text-surface-500 text-xs font-bold uppercase tracking-wider mb-2">
        Requisitos
      </Text>
      <View className="gap-1.5 mb-5">
        {item.requisitos_obligatorios.map((req: any) => (
          <View key={req.id} className="flex-row items-center gap-2">
            <View className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            <Text className="text-surface-700 text-sm font-medium flex-1">
              {req.nombre}
            </Text>
          </View>
        ))}
      </View>

      {isAdmin ? (
        <Button
          label="Ver Postulantes"
          variant="outline"
          onPress={() => router.push(`/(tabs)/convocatorias/${item.id}/postulantes` as any)}
        />
      ) : (
        item.ya_postulo ? (
          <Button
            label="Ver mi postulación"
            variant="glass"
            onPress={() => router.push(`/(tabs)/mis-postulaciones/${item.id_postulacion}` as any)}
          />
        ) : (
          <Button
            label="Postularme"
            variant="primary"
            loading={isPending}
            onPress={handlePostular}
          />
        )
      )}
    </Card>
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
    <SafeAreaView style={{ flex: 1 }} className="bg-surface-50">
      <Header title="Convocatorias" showBack={false} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 160, flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">

          {/* Encabezado */}
          <View className="mb-8">
            <Text className="text-4xl font-extrabold text-surface-900 tracking-tight">Convocatorias</Text>
            <Text className="text-base text-surface-500 mt-2 font-medium">Explora las vacantes disponibles y aplica.</Text>
          </View>

          {/* Buscador */}
          <View className="flex-row items-center border border-surface-200 bg-white rounded-xl px-4 py-1 mb-8 shadow-sm">
            <TextInput
              className="flex-1 text-surface-900 py-3 text-base font-medium"
              placeholder="Buscar convocatoria por nombre..."
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ outline: 'none' } as any}
            />
          </View>

          {/* Estado de carga */}
          {isLoading && (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator color="#3b82f6" size="large" />
              <Text className="text-brand-600 font-medium text-sm mt-4">Cargando datos...</Text>
            </View>
          )}

          {/* Estado de error */}
          {isError && (
            <View className="flex-1 justify-center items-center bg-red-50 p-6 rounded-2xl border border-red-100">
              <Text className="text-red-600 font-semibold text-center mb-1">Error de conexión</Text>
              <Text className="text-red-500 text-sm text-center">
                No se pudieron cargar las convocatorias.
              </Text>
            </View>
          )}

          {/* Lista */}
          {!isLoading && !isError && (
            <View style={{ paddingBottom: 20 }}>
              {data?.items.length === 0 ? (
                <View className="items-center justify-center py-20">
                  <Text className="text-surface-400 font-semibold text-lg">No hay vacantes activas</Text>
                  <Text className="text-surface-400 text-sm mt-1 text-center">Intenta buscar con otro término o vuelve más tarde.</Text>
                </View>
              ) : (
                data?.items.map((item: any) => (
                  <ConvocatoriaCard key={item.id} item={item} isAdmin={isAdmin} />
                ))
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

