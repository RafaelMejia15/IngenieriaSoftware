import { useAuthStore } from "@/stores/useAuthStore";
import { Text, View, SafeAreaView, ScrollView, Pressable, Platform } from "react-native";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import AntDesign from '@expo/vector-icons/AntDesign';
import { ProfileDropdown } from "@/components/ui/ProfileDropdown";
import { router } from "expo-router";

export default function HubIndex() {
    const { user } = useAuthStore();

    const rolRaw = (user?.rol || '').toLowerCase();
    const rol = (rolRaw === 'admin' || rolRaw === 'administrador') ? 'admin' : rolRaw;

    return (
        <SafeAreaView style={{ flex: 1 }} className="bg-zinc-950">
            {/* --- TOP BAR (Header) --- */}
            <View className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex-row justify-between items-center z-50">
                <View>
                    <Text className="text-lg font-semibold text-zinc-50 ">Administrador de Convocatorias</Text>
                    <Text className="text-xs text-purple-400 font-semibold uppercase tracking-widest">SIPID</Text>
                </View>

                {/* Contenedor del Avatar y Menú Desplegable */}
                <ProfileDropdown />
            </View>

            {/* --- CONTENIDO PRINCIPAL --- */}
            <View style={{ flex: 1 }} className="flex-grow">
                <ScrollView
                    className="h-full"
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
                >
                    <View className="w-full max-w-5xl mx-auto px-6 py-8 md:py-12">

                        {/* Hero Section */}
                        <View className="mb-10">
                            <Text className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-3">
                                Panel Principal
                            </Text>
                            <Text className="text-4xl md:text-5xl font-semibold text-zinc-50 tracking-tight mb-2">
                                Hola, {user?.nombre || 'Usuario'} <FontAwesome name="hand-peace-o" size={36} color="#fbbf24" />
                            </Text>
                            <Text className="text-base text-zinc-400 font-medium">
                                Selecciona un módulo para comenzar a trabajar.
                            </Text>
                        </View>

                        {/* Grid de Módulos */}
                        <View className="flex-row flex-wrap justify-between gap-y-6">

                            {/* Tarjeta: Convocatorias */}
                            <Pressable
                                onPress={() => router.push('/(tabs)/convocatorias' as any)}
                                className="w-full md:w-[48%] bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-purple-500/40 hover:bg-zinc-800/80 transition-all active:bg-zinc-800"
                            >
                                <View className="w-12 h-12 bg-purple-600/20 border border-purple-500/30 rounded-2xl items-center justify-center mb-4">
                                    <AntDesign name="file" size={24} color="#c084fc" />
                                </View>
                                <Text className="text-xl font-semibold text-zinc-50 mb-2 tracking-tight">
                                    Convocatorias
                                </Text>
                                <Text className="text-sm text-zinc-400 leading-relaxed">
                                    Explora las vacantes disponibles, revisa los requisitos y gestiona tus postulaciones activas.
                                </Text>
                                {/* Purple accent line on hover */}
                                <View className="mt-4 flex-row items-center">
                                    <Text className="text-xs font-bold text-purple-400 uppercase tracking-widest">Explorar →</Text>
                                </View>
                            </Pressable>

                            {/* Tarjeta: Mis Postulaciones (Solo Usuario) */}
                            {rol !== 'admin' && (
                                <Pressable
                                    onPress={() => router.push('/(tabs)/mis-postulaciones' as any)}
                                    className="w-full md:w-[48%] bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-purple-500/40 hover:bg-zinc-800/80 transition-all active:bg-zinc-800"
                                >
                                    <View className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl items-center justify-center mb-4">
                                        <AntDesign name="file" size={24} color="#10b981" />
                                    </View>
                                    <Text className="text-xl font-semibold text-zinc-50 mb-2 tracking-tight">
                                        Mis Postulaciones
                                    </Text>
                                    <Text className="text-sm text-zinc-400 leading-relaxed">
                                        Revisa el estado de tus postulaciones y gestiona los documentos requeridos.
                                    </Text>
                                    <View className="mt-4 flex-row items-center">
                                        <Text className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Ver estado →</Text>
                                    </View>
                                </Pressable>
                            )}

                            {/* Tarjeta: Nueva Convocatoria (Solo Admin) */}
                            {rol === 'admin' && (
                                <Pressable
                                    onPress={() => router.push('/(tabs)/nueva-convocatoria' as any)}
                                    className="w-full md:w-[48%] bg-purple-600/10 border border-purple-500/30 rounded-3xl p-6 hover:bg-purple-600/20 hover:border-purple-500/60 transition-all active:bg-purple-600/30"
                                >
                                    <View className="w-12 h-12 bg-purple-600/30 border border-purple-500/40 rounded-2xl items-center justify-center mb-4">
                                        <Entypo name="add-to-list" size={24} color="#c084fc" />
                                    </View>
                                    <Text className="text-xl font-semibold text-zinc-50 mb-2 tracking-tight">
                                        Nueva Convocatoria
                                    </Text>
                                    <Text className="text-sm text-zinc-400 leading-relaxed">
                                        Crea y publica una nueva vacante en el sistema definiendo fechas y requisitos obligatorios.
                                    </Text>
                                    <View className="mt-4 flex-row items-center">
                                        <Text className="text-xs font-bold text-purple-400 uppercase tracking-widest">Crear ahora →</Text>
                                    </View>
                                </Pressable>
                            )}

                        </View>

                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}