import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { useLoginMutation } from '@/features/index/api/authMutation';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import * as Yup from 'yup';


// Esquema de validación con Yup
// Yup es como "zod" pero más compatible con Formik
const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Ingresa un correo válido')
    .required('El correo es requerido'),
  password: Yup.string()
    .min(6, 'Mínimo 6 caracteres')
    .required('La contraseña es requerida'),
});

export default function LoginScreen() {
  // useRouter es el equivalente de useNavigate() en react-router-dom
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
    // KeyboardAvoidingView sube el contenido cuando el teclado virtual aparece,
    // equivalente a nada en web (el browser lo maneja solo), pero en móvil es esencial
    <KeyboardAvoidingView
      className="flex-1 bg-zinc-950"
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      enabled={Platform.OS !== 'web'}
    >
      <View className="flex-1 justify-center w-full md:w-[800px] mx-auto p-4 md:p-20">

        {/* Encabezado */}
        <View className="mb-10">
          <Text className="text-3xl font-bold text-white tracking-tight">
            Bienvenido
          </Text>
          <Text className="text-sm text-zinc-400 mt-1">
            Inicia sesión para continuar
          </Text>
        </View>

        {/*
          Formik funciona igual que en React Web:
          - initialValues: valores iniciales del formulario
          - validationSchema: reglas de validación (Yup)
          - onSubmit: función que se llama cuando el formulario es válido
          - values, errors, touched, handleChange, handleSubmit: mismos conceptos que en web
        */}
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
          <View className="mt-2">
            <Text className="text-red-400 text-md text-center">{errorMessage}</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
