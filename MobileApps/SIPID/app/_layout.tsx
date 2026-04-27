import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import "../global.css";
import { useAuthStore } from '@/stores/useAuthStore';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { LogBox } from 'react-native';
LogBox.ignoreAllLogs(false);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function RootLayoutNav() {
  const { token } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // En RootLayoutNav, reemplaza el primer useEffect con:
  useEffect(() => {
    const hydrated = useAuthStore.persist.hasHydrated();
    if (hydrated) {
      setIsReady(true);
      return;
    }

    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setIsReady(true);
    });

    // Fallback de seguridad: si tarda más de 3s, forzamos isReady
    const timeout = setTimeout(() => setIsReady(true), 3000);

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!token && inAuthGroup) {
      router.replace('/');
    } else if (token && !inAuthGroup) {
      router.replace('/(tabs)/hub');
    }
  }, [token, segments, isReady]);

  // Mientras Zustand rehidrata, mostramos un fondo negro para evitar flash de blanco
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}
