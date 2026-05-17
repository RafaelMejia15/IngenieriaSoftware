import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View, Pressable, Platform } from "react-native";

export function ProfileDropdown() {
    const { user, logout } = useAuthStore();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const router = useRouter();

    if (!user) return null;

    const rolRaw = (user.rol || '').toLowerCase();
    const rol = (rolRaw === 'admin' || rolRaw === 'administrador') ? 'admin' : rolRaw;
    const inicial = user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U';

    const handleLogout = () => {
        logout();
        router.replace('/');
    };

    return (
        <View className="relative z-50">
            <Pressable
                onPress={() => setIsProfileOpen(!isProfileOpen)}
                className={`w-11 h-11 rounded-full items-center justify-center border-2 transition-all ${
                    isProfileOpen
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
                    <Text className="text-xl font-semibold text-zinc-50 mb-1">{user.nombre || 'Usuario'}</Text>
                    <Text className="text-sm text-zinc-400 mb-4">{user.email || 'correo@ejemplo.com'}</Text>

                    <View className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-6">
                        <Text className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Nivel de Acceso</Text>
                        <View className="flex-row items-center">
                            <View className={`w-2 h-2 rounded-full mr-2 ${rol === 'admin' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                            <Text className="text-sm font-bold text-zinc-200 uppercase">{user.rol || 'N/A'}</Text>
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
    );
}
