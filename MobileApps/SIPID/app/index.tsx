import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { useLoginMutation } from '@/features/index/api/authMutation';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Yup from 'yup';


const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Ingresa un correo válido')
    .required('El correo es requerido'),
  password: Yup.string()
    .min(6, 'Mínimo 6 caracteres')
    .required('La contraseña es requerida'),
});

export default function LoginScreen() {
  const router = useRouter();
  const { mutateAsync: loginAction, isPending } = useLoginMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      await loginAction(values);
      router.replace('/(tabs)/hub');
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setErrorMessage('Usuario o contraseña incorrecta');
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-zinc-950"
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      enabled={Platform.OS !== 'web'}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="justify-center w-full md:w-[800px] mx-auto p-4 md:p-20 flex-grow">

          {/* Encabezado */}
          <View className="mb-10">
            {/* Micro-copy: SIPID tag */}
            <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">
              SIPID · Sistema de Postulaciones
            </Text>
            <Text className="text-4xl font-bold text-zinc-50 tracking-tight">
              Bienvenido
            </Text>
            <Text className="text-sm text-zinc-400 mt-2">
              Inicia sesión para continuar
            </Text>
          </View>

          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={LoginSchema}
            onSubmit={handleLogin}
          >
            {({ values, errors, touched, handleChange, setFieldTouched, handleSubmit, isSubmitting }) => (
              <View className="gap-4">
                <InputField
                  label="Correo"
                  placeholder="ejemplo@correo.com"
                  value={values.email}
                  onChangeText={handleChange('email')}
                  onBlur={() => setFieldTouched('email', true)}
                  error={touched.email && errors.email ? errors.email : undefined}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <InputField
                  label="Contraseña"
                  placeholder="••••••••"
                  value={values.password}
                  onChangeText={handleChange('password')}
                  onBlur={() => setFieldTouched('password', true)}
                  error={touched.password && errors.password ? errors.password : undefined}
                  secureTextEntry
                />

                <View className="mt-2">
                  <Button
                    label="Iniciar sesión"
                    onPress={() => handleSubmit()}
                    loading={isSubmitting || isPending}
                  />
                </View>
              </View>
            )}
          </Formik>

          {errorMessage && (
            <View className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <Text className="text-red-400 text-sm text-center font-medium">{errorMessage}</Text>
            </View>
          )}

          {/* Links de navegación */}
          <View className="mt-8 gap-3 items-center">
            <Pressable onPress={() => router.push('/forgot-password')}>
              <Text className="text-zinc-500 text-sm">
                ¿Olvidaste tu contraseña?{' '}
                <Text className="text-purple-400 font-semibold">Recupérala aquí</Text>
              </Text>
            </Pressable>

            <Pressable onPress={() => router.push('/register')}>
              <Text className="text-zinc-500 text-sm">
                ¿No tienes cuenta?{' '}
                <Text className="text-purple-400 font-semibold">Regístrate</Text>
              </Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
