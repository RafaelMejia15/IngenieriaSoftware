import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View, SafeAreaView, ScrollView, Pressable, Platform } from "react-native";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo'
import AntDesign from '@expo/vector-icons/AntDesign'

export default function HubIndex() {
    const { user, logout } = useAuthStore();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const rolRaw = (user?.rol || '').toLowerCase();
    const rol = (rolRaw === 'admin' || rolRaw === 'administrador') ? 'admin' : rolRaw;

    // Obtenemos la inicial del usuario para el avatar
    const inicial = user?.nombre ? user.nombre.charAt(0).toUpperCase() : 'U';

    const handleLogout = () => {
        logout();
        router.replace('/');
    };

    return (
        <SafeAreaView className="flex-1 bg-zinc-950">
            {/* --- TOP BAR (Header) --- */}
            <View className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex-row justify-between items-center z-50">
                <View>
                    <Text className="text-lg font-semibold text-zinc-50 ">Administrador de Convocatorias</Text>
                    <Text className="text-xs text-purple-400 font-semibold uppercase tracking-widest">SIPID</Text>
                </View>

                {/* Contenedor del Avatar y Menú Desplegable */}
                <View className="relative">
                    <Pressable
                        onPress={() => setIsProfileOpen(!isProfileOpen)}
                        className={`w-11 h-11 rounded-full items-center justify-center border-2 transition-all ${isProfileOpen
                            ? 'border-purple-500 bg-purple-600'
                            : 'border-zinc-700 bg-zinc-800 hover:border-purple-500/50'
                            }`}
                    >
                        <Text className={`font-bold text-lg ${isProfileOpen ? 'text-white' : 'text-zinc-300'}`}>
                            {inicial}
                        </Text>
                    </Pressable>

                    {/* Menú Desplegable (Flotante) */}
                    {isProfileOpen && (
                        <View
                            className="absolute right-0 top-14 bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl min-w-[280px]"
                            style={Platform.OS === 'web' ? { zIndex: 100 } : {}}
                        >
                            <Text className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">
                                Perfil de Usuario
                            </Text>
                            <Text className="text-xl font-semibold text-zinc-50 mb-1">{user?.nombre || 'Usuario'}</Text>
                            <Text className="text-sm text-zinc-400 mb-4">{user?.email || 'correo@ejemplo.com'}</Text>

                            <View className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-6">
                                <Text className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Nivel de Acceso</Text>
                                <View className="flex-row items-center">
                                    <View className={`w-2 h-2 rounded-full mr-2 ${rol === 'admin' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                                    <Text className="text-sm font-bold text-zinc-200 uppercase">{user?.rol || 'N/A'}</Text>
                                </View>
                            </View>

                            <Button
                                label="Cerrar sesión"
                                onPress={handleLogout}
                                variant="outline"
                            />
                        </View>
                    )}
                </View>
            </View>

            {/* --- CONTENIDO PRINCIPAL --- */}
            {/* Si tocan fuera del menú, lo cerramos */}
            <Pressable
                className="flex-1"
                onPress={() => isProfileOpen && setIsProfileOpen(false)}
            >
                <ScrollView
                    className="flex-1"
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
            </Pressable>
        </SafeAreaView>
    );
}