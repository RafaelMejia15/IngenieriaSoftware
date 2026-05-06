import { useConvocatoriasActivasQuery } from '@/features/vacantes/api/vacantesQueries';
import { Convocatoria } from '@/types/vacantes.types';
import { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

function ConvocatoriaCard({ item }: { item: Convocatoria }) {
  const inicio = new Date(item.fecha_inicio).toLocaleDateString('es-MX');
  const fin = new Date(item.fecha_fin).toLocaleDateString('es-MX');

  return (
    <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-bold text-base flex-1 mr-2">{item.nombre}</Text>
        <View className="bg-zinc-800 px-3 py-1 rounded-full">
          <Text className="text-zinc-400 text-xs">{item.estado}</Text>
        </View>
      </View>

      <Text className="text-zinc-500 text-xs mb-3">
        {inicio} — {fin}
      </Text>

      <View className="h-[1px] bg-zinc-800 mb-3" />

      <Text className="text-zinc-400 text-xs mb-2 uppercase tracking-widest">
        Requisitos obligatorios
      </Text>
      {item.requisitos_obligatorios.map((req) => (
        <Text key={req.id} className="text-zinc-300 text-sm mb-1">
          · {req.codigo} — {req.nombre}
        </Text>
      ))}
    </View>
  );
}

export default function ConvocatoriasScreen() {
  const [query, setQuery] = useState('');
  // Solo hace la petición cuando el usuario ha dejado de tipear (query actual)
  const { data, isLoading, isError } = useConvocatoriasActivasQuery(query || undefined);

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <View className="flex-1 p-4">

        {/* Encabezado */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-white tracking-tight">Convocatorias</Text>
          <Text className="text-sm text-zinc-400 mt-1">Vacantes activas disponibles</Text>
        </View>

        {/* Buscador */}
        <View className="flex-row items-center border border-zinc-800 bg-zinc-900 rounded-xl px-4 mb-6">
          <TextInput
            className="flex-1 text-white py-3 text-base"
            placeholder="Buscar convocatoria..."
            placeholderTextColor="#52525b"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Estado de carga */}
        {isLoading && (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator color="#ffffff" size="large" />
            <Text className="text-zinc-500 text-sm mt-4">Cargando convocatorias...</Text>
          </View>
        )}

        {/* Estado de error */}
        {isError && (
          <View className="flex-1 justify-center items-center">
            <Text className="text-red-400 text-center">
              No se pudieron cargar las convocatorias.{'\n'}Verifica tu conexión.
            </Text>
          </View>
        )}

        {/* Lista */}
        {!isLoading && !isError && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {data?.items.length === 0 ? (
              <Text className="text-zinc-500 text-center mt-10">
                No hay convocatorias activas{query ? ` para "${query}"` : ''}.
              </Text>
            ) : (
              data?.items.map((item) => (
                <ConvocatoriaCard key={item.id} item={item} />
              ))
            )}
          </ScrollView>
        )}

      </View>
    </SafeAreaView>
  );
}
