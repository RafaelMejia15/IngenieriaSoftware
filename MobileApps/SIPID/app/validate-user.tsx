import { useValidateUserMutation } from '@/features/index/api/authMutation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';

export default function ValidateUserScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { mutateAsync: validate } = useValidateUserMutation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu cuenta...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Enlace inválido: no se encontró el token.');
      return;
    }

    validate(token)
      .then((response) => {
        setStatus('success');
        setMessage(response.msg || 'Cuenta activada correctamente.');
      })
      .catch(() => {
        setStatus('error');
        setMessage('El enlace expiró o ya fue utilizado.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-zinc-950 justify-center items-center p-8">
      {status === 'loading' && (
        <View className="items-center gap-4">
          <ActivityIndicator color="#ffffff" size="large" />
          <Text className="text-zinc-400 text-sm mt-4">Verificando tu cuenta...</Text>
        </View>
      )}

      {status === 'success' && (
        <View className="items-center gap-6 w-full">
          <View className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full items-center">
            <Text className="text-4xl mb-4">✅</Text>
            <Text className="text-white text-xl font-bold text-center mb-2">
              ¡Cuenta activada!
            </Text>
            <Text className="text-zinc-400 text-sm text-center">{message}</Text>
          </View>
          <View className="w-full">
            <Button
              label="Ir al login"
              onPress={() => router.replace('/')}
            />
          </View>
        </View>
      )}

      {status === 'error' && (
        <View className="items-center gap-6 w-full">
          <View className="bg-zinc-900 border border-red-900 rounded-3xl p-8 w-full items-center">
            <Text className="text-4xl mb-4">❌</Text>
            <Text className="text-white text-xl font-bold text-center mb-2">
              Enlace inválido
            </Text>
            <Text className="text-zinc-400 text-sm text-center">{message}</Text>
          </View>
          <View className="w-full">
            <Button
              label="Volver al login"
              onPress={() => router.replace('/')}
              variant="outline"
            />
          </View>
        </View>
      )}
    </View>
  );
}
