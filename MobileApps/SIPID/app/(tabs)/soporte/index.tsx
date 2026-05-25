import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Pressable, TextInput, Platform } from 'react-native';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuditoriaLogQuery } from '@/features/postulaciones/api/postulacionesHooks';
import { useState } from 'react';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SoporteAuditoriaScreen() {
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);
  const [accion, setAccion] = useState('');
  const [idUsuario, setIdUsuario] = useState('');
  
  // Format filter query params
  const params: any = {
    limit,
    offset,
  };
  if (accion) params.accion = accion;
  if (idUsuario.trim()) params.id_usuario = idUsuario.trim();

  const { data, isLoading, isError, refetch } = useAuditoriaLogQuery(params);

  const handleNextPage = () => {
    if (data && offset + limit < data.total) {
      setOffset(prev => prev + limit);
    }
  };

  const handlePrevPage = () => {
    if (offset - limit >= 0) {
      setOffset(prev => prev - limit);
    }
  };

  const handleResetFilters = () => {
    setAccion('');
    setIdUsuario('');
    setOffset(0);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const actions = [
    { label: 'Todos', value: '' },
    { label: 'Login 🔑', value: 'LOGIN' },
    { label: 'Registro 📝', value: 'REGISTRO' },
    { label: 'Subir Doc 📁', value: 'UPLOAD_DOCUMENT' },
    { label: 'Eliminar Doc 🗑️', value: 'DELETE_DOCUMENT' },
    { label: 'Enviar Exp ✉️', value: 'ENVIAR_POSTULACION' },
    { label: 'Validar Doc 🔍', value: 'VALIDACION_DOCUMENTO' },
    { label: 'Cambiar Est 🔄', value: 'CAMBIO_ESTADO' },
    { label: 'Dictamen 🏛️', value: 'DICTAMEN_FINAL' },
    { label: 'Exp CSV 📊', value: 'EXPORT_CSV' },
    { label: 'Exp ZIP 📦', value: 'EXPORT_ZIP' },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-zinc-950">
      <Header title="Bitácora" showHub={true} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}>
        <View className="p-4 md:p-8 max-w-6xl w-full mx-auto flex-grow">
          
          {/* Title bar */}
          <View className="mb-8">
            <Text className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Soporte TI</Text>
            <Text className="text-3xl md:text-4xl font-bold text-zinc-50 tracking-tight">Bitácora de Auditoría</Text>
            <Text className="text-sm text-zinc-400 mt-2 font-medium">Registro cronológico de seguridad y acciones administrativas del sistema.</Text>
          </View>

          {/* Filters Bar */}
          <Card className="mb-6 p-5 bg-zinc-900 border border-zinc-800 rounded-3xl">
            <Text className="text-zinc-50 font-bold mb-4 text-base">Filtros de Búsqueda</Text>
            
            {/* Search by User ID */}
            <View className="mb-4">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">ID de Usuario (UUID)</Text>
              <View className="flex-row space-x-2 items-center bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2">
                <AntDesign name="search" size={16} color="#71717a" className="mr-2" />
                <TextInput
                  className="flex-1 text-zinc-50 text-sm font-medium py-1"
                  placeholder="Ej: f47ac10b-58cc-4372-a567-0e02b2c3d479"
                  placeholderTextColor="#52525b"
                  value={idUsuario}
                  onChangeText={(val) => {
                    setIdUsuario(val);
                    setOffset(0);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={Platform.OS === 'web' ? { outline: 'none', color: '#fafafa' } as any : {}}
                />
              </View>
            </View>

            {/* Event Type / Action Filter */}
            <View className="mb-4">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-3">Filtrar por Acción</Text>
              <View className="flex-row flex-wrap gap-2">
                {actions.map((act) => (
                  <Pressable
                    key={act.value}
                    onPress={() => {
                      setAccion(act.value);
                      setOffset(0);
                    }}
                    className={`px-3 py-1.5 rounded-full border transition-all ${
                      accion === act.value
                        ? 'bg-amber-500/20 border-amber-500/55 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${
                      accion === act.value ? 'text-amber-400' : 'text-zinc-400'
                    }`}>
                      {act.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Clear filters Button */}
            {(accion || idUsuario) && (
              <View className="flex-row justify-end mt-2">
                <Button
                  label="Limpiar Filtros"
                  variant="outline"
                  onPress={handleResetFilters}
                />
              </View>
            )}
          </Card>

          {/* Activity State */}
          {isLoading && (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator color="#fbbf24" size="large" />
              <Text className="text-zinc-500 font-bold text-xs mt-4 tracking-widest uppercase">Cargando registros...</Text>
            </View>
          )}

          {isError && (
            <View className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl my-6 items-center">
              <Text className="text-red-400 font-bold text-lg mb-1">Error de conexión</Text>
              <Text className="text-red-400/70 text-sm text-center">No se pudieron cargar los registros de auditoría. Verifica tus privilegios.</Text>
            </View>
          )}

          {/* Grid/Table View */}
          {!isLoading && !isError && (
            <View>
              {(!data?.items || data.items.length === 0) ? (
                <View className="items-center justify-center py-24 bg-zinc-900 border border-zinc-800 rounded-3xl border-dashed">
                  <Text className="text-4xl mb-4">📭</Text>
                  <Text className="text-zinc-50 font-bold text-xl mb-1">Sin registros coincidentes</Text>
                  <Text className="text-zinc-500 text-sm text-center">No se encontraron eventos en la bitácora que correspondan a tu búsqueda.</Text>
                </View>
              ) : (
                <View className="flex-col gap-4">
                  
                  {/* Total indicator */}
                  <View className="flex-row justify-between items-center px-2">
                    <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                      Mostrando {data.items.length} de {data.total} eventos
                    </Text>
                    <Pressable onPress={() => refetch()} className="p-1 hover:bg-zinc-800 rounded-lg">
                      <AntDesign name="reload" size={14} color="#71717a" />
                    </Pressable>
                  </View>

                  {/* Render Log Cards */}
                  {data.items.map((log: any) => {
                    const dateStr = new Date(log.registrado_en).toLocaleString('es-MX', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    return (
                      <Card key={log.id_evento} className="p-5 border border-zinc-850 hover:border-zinc-700 transition-all bg-zinc-900">
                        <View className="flex-row justify-between items-start flex-wrap gap-2 mb-3">
                          <View className="flex-row items-center space-x-2">
                            <Badge
                              label={log.accion}
                              variant={
                                log.accion === 'LOGIN'
                                  ? 'success'
                                  : log.accion.startsWith('EXPORT')
                                  ? 'info'
                                  : log.accion.includes('REJECT') || log.accion.includes('DELETE')
                                  ? 'error'
                                  : 'default'
                              }
                            />
                            {log.ip && (
                              <Text className="text-zinc-500 text-xs font-semibold bg-zinc-950 px-2.5 py-0.5 rounded-md ml-2 border border-zinc-850">
                                IP: {log.ip}
                              </Text>
                            )}
                          </View>
                          <Text className="text-zinc-500 text-xs font-semibold">{dateStr}</Text>
                        </View>

                        <View className="space-y-2 mt-1">
                          <View className="flex-row items-center">
                            <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider w-24">Usuario ID:</Text>
                            <Text className="text-zinc-300 text-xs font-mono bg-zinc-950/70 px-2 py-0.5 rounded border border-zinc-850 flex-1 overflow-hidden" numberOfLines={1}>
                              {log.id_usuario || 'Anónimo / Desconocido'}
                            </Text>
                          </View>

                          {log.detalle && (
                            <View className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 mt-3">
                              <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">Detalles del Evento</Text>
                              <View className="gap-1.5">
                                {Object.entries(log.detalle).map(([key, value]) => (
                                  <View key={key} className="flex-row flex-wrap">
                                    <Text className="text-purple-400 font-semibold text-xs mr-2">{key}:</Text>
                                    <Text className="text-zinc-300 text-xs flex-1">{String(value)}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      </Card>
                    );
                  })}

                  {/* Pagination Actions */}
                  {totalPages > 1 && (
                    <View className="flex-row items-center justify-between mt-6 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl">
                      <Button
                        label="Anterior"
                        variant="outline"
                        onPress={handlePrevPage}
                        disabled={offset === 0}
                      />
                      <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                        Página {currentPage} de {totalPages}
                      </Text>
                      <Button
                        label="Siguiente"
                        variant="outline"
                        onPress={handleNextPage}
                        disabled={offset + limit >= data.total}
                      />
                    </View>
                  )}

                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
