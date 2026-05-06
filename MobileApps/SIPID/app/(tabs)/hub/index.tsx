import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";
import { Text, View, SafeAreaView, ScrollView, Pressable } from "react-native";

export default function HubIndex() {
    const { user, logout } = useAuthStore();
    const rol = user?.username?.toLowerCase(); // "admin" | "usuario"

    const handleLogout = () => {
        logout();
        router.replace('/');
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1" contentContainerClassName="p-6">
                {/* Encabezado */}
                <View className="bg-zinc-50 p-8 rounded-3xl w-full border border-zinc-200 mb-6">
                    <Text className="text-zinc-400 text-sm uppercase tracking-widest font-bold mb-2">
                        Bienvenido de nuevo
                    </Text>
                    <Text className="text-zinc-900 text-4xl font-black mb-6">
                        {user?.nombre || 'Usuario'}
                    </Text>

                    <View className="h-[1px] bg-zinc-200 w-full mb-8" />

                    <View className="gap-4">
                        <View className="bg-white p-4 rounded-2xl border border-zinc-100">
                            <Text className="text-zinc-400 text-xs mb-1">Rol devuelto por Backend</Text>
                            <Text className="text-zinc-900 font-medium">{user?.username || 'N/A'}</Text>
                        </View>
                        <View className="bg-white p-4 rounded-2xl border border-zinc-100">
                            <Text className="text-zinc-400 text-xs mb-1">Mensaje del Backend</Text>
                            <Text className="text-zinc-900 font-medium">{user?.nombre || 'N/A'}</Text>
                        </View>
                    </View>
                </View>

                {/* Navegación por rol */}
                <View className="gap-4 mb-6">
                    <Text className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
                        Módulos disponibles
                    </Text>

                    {/* Todos los usuarios pueden ver convocatorias */}
                    <Pressable
                        onPress={() => router.push('/(tabs)/convocatorias' as any)}
                        className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 active:bg-zinc-100"
                    >
                        <Text className="text-zinc-900 font-bold text-base mb-1">
                            📋 Convocatorias
                        </Text>
                        <Text className="text-zinc-500 text-sm">
                            Ver vacantes activas y sus requisitos
                        </Text>
                    </Pressable>

                    {/* Solo admin puede crear convocatorias */}
                    {rol === 'admin' && (
                        <Pressable
                            onPress={() => router.push('/(tabs)/nueva-convocatoria' as any)}
                            className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 active:bg-zinc-100"
                        >
                            <Text className="text-zinc-900 font-bold text-base mb-1">
                                ➕ Nueva Convocatoria
                            </Text>
                            <Text className="text-zinc-500 text-sm">
                                Crear y publicar una nueva vacante
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* Cerrar sesión */}
                <View className="mb-8">
                    <Button
                        label="Cerrar sesión"
                        onPress={handleLogout}
                        variant="outline"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}