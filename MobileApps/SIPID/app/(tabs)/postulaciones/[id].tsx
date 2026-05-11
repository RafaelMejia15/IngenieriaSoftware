import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator, Pressable, Linking } from 'react-native';
import { usePostulacionDetalleAdminQuery } from '@/features/postulaciones/api/postulacionesHooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';

export default function PostulacionDetalleAdminScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data: post, isLoading, isError } = usePostulacionDetalleAdminQuery(id as string);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface-50">
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (isError || !post) {
    return (
      <SafeAreaView className="flex-1 bg-surface-50">
        <Header title="Detalle" showHub={true} />
        <View className="flex-1 p-4 md:p-8">
          <View className="bg-red-50 p-6 rounded-2xl border border-red-100 mb-6">
            <Text className="text-red-600 font-semibold text-center">Error al cargar detalles de la postulación</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-50">
      <Header title="Detalle de Aspirante" showHub={true} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 md:p-8 max-w-4xl w-full mx-auto flex-grow">
          <View className="mb-8">
            <Text className="text-3xl font-extrabold text-surface-900 tracking-tight">{post.usuario.correo}</Text>
            <Text className="text-base text-surface-500 mt-2 font-medium">Postulación a: {post.nombre_convocatoria}</Text>
            <View className="flex-row items-center mt-3">
              <Badge label={post.estado} variant="info" className="mr-3" />
            </View>
          </View>

          <Text className="text-surface-900 font-bold text-xl mb-4">Documentos Subidos</Text>
          
          <View>
            {(!post.documentos || post.documentos.length === 0) ? (
              <View className="items-center justify-center py-10 bg-white rounded-2xl border border-surface-200 shadow-sm">
                <Text className="text-surface-400 font-semibold text-base">No ha subido ningún documento aún</Text>
              </View>
            ) : (
              post.documentos.map((doc: any) => (
                <Card key={doc.id_requisito} className="mb-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-surface-900 font-semibold text-base">{doc.nombre}</Text>
                      <Text className="text-surface-500 text-xs mt-1 uppercase tracking-wider">{doc.codigo}</Text>
                    </View>
                  </View>
                  
                  <View className="bg-surface-50 border border-surface-200 p-3 rounded-xl mt-3 flex-row items-center justify-between">
                    <View>
                      <Text className="text-surface-800 font-medium text-sm">{doc.nombre_original}</Text>
                      <Text className="text-surface-500 text-xs mt-0.5">{(doc.tamano_bytes / 1024).toFixed(1)} KB • {new Date(doc.subido_en).toLocaleDateString()}</Text>
                    </View>
                    <Button 
                      label="Ver" 
                      variant="glass" 
                      onPress={() => Linking.openURL(doc.presigned_download_url)} 
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
