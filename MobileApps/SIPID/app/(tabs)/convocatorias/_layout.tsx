import { Stack } from 'expo-router';

export default function ConvocatoriasLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/postulantes" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}
