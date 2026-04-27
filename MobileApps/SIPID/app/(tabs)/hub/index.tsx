import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";
import { Text, View, SafeAreaView } from "react-native";

export default function HubIndex() {
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        router.replace('/');
    };

    return (
        <SafeAreaView className="flex-1 bg-zinc-950">
            <View className="flex-1 justify-center items-center p-6">
                <View className="bg-zinc-900 p-8 rounded-3xl w-full border border-zinc-800 shadow-2xl">
                    <Text className="text-zinc-500 text-sm uppercase tracking-widest font-bold mb-2">
                        Bienvenido de nuevo
                    </Text>
                    <Text className="text-white text-4xl font-black mb-6">
                        {user?.nombre || 'Usuario'}
                    </Text>

                    <View className="h-[1px] bg-zinc-800 w-full mb-8" />

                    <View className="gap-4">
                        <View className="bg-zinc-800/50 p-4 rounded-2xl">
                            <Text className="text-zinc-400 text-xs mb-1">Rol devuelto por Backend</Text>
                            <Text className="text-white font-medium">{user?.username || 'N/A'}</Text>
                        </View>
                        <View className="bg-zinc-800/50 p-4 rounded-2xl">
                            <Text className="text-zinc-400 text-xs mb-1">Mensaje del Backend</Text>
                            <Text className="text-white font-medium">{user?.nombre || 'N/A'}</Text>
                        </View>
                    </View>

                    <View className="mt-10">
                        <Button
                            label="Cerrar sesión"
                            onPress={handleLogout}
                            variant="outline"
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}