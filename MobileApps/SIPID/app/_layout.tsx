import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import "../global.css";

// QueryClient es la "instancia central" de React Query.
// Guarda el caché, maneja los estados de carga/error/éxito.
// Debe existir UNO solo en toda la app, justo aquí en el layout raíz.
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    // QueryClientProvider es como Context.Provider — hace disponible
    // el queryClient a todos los componentes hijos de la app.
    // Sin él, cualquier hook de React Query (useMutation, useQuery) falla.
    <QueryClientProvider client={queryClient}>
      <Stack>
        {/* "index" = app/index.tsx = pantalla de login */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* "(tabs)" = carpeta app/(tabs)/ con su propio layout */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}

