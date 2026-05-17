import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import "../global.css";
import { useAuthStore } from '@/stores/useAuthStore';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { LogBox } from 'react-native';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
LogBox.ignoreAllLogs(false);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

// Custom Premium Dark Enterprise SaaS Theme, extending Navigation DarkTheme (required in v7)
const MyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#8b5cf6',      // violet-500
    background: '#09090b',   // zinc-950
    card: '#09090b',         // zinc-950
    text: '#fafafa',         // zinc-50
    border: '#27272a',       // zinc-800
    notification: '#8b5cf6',
  },
};

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
    <ThemeProvider value={MyDarkTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="validate-user" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );

}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

