import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { useForgotPasswordMutation } from '@/features/index/api/authMutation';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import * as Yup from 'yup';

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Ingresa un correo válido')
    .required('El correo es requerido'),
});

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { mutateAsync: sendForgot, isPending } = useForgotPasswordMutation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleForgot = async (values: { email: string }) => {
    try {
      const response = await sendForgot(values.email);
      setSuccessMessage(response.msg || 'Revisa tu correo.');
      setErrorMessage(null);
    } catch {
      setErrorMessage('No se pudo enviar el correo. Intenta de nuevo.');
      setSuccessMessage(null);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-zinc-950"
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      enabled={Platform.OS !== 'web'}
    >
      <View className="flex-1 justify-center w-full md:w-[800px] mx-auto p-4 md:p-20">

        {/* Encabezado */}
        <View className="mb-10">
          <Text className="text-3xl font-bold text-white tracking-tight">
            Recuperar contraseña
          </Text>
          <Text className="text-sm text-zinc-400 mt-1">
            Ingresa tu correo y te enviaremos un enlace
          </Text>
        </View>

        <Formik
          initialValues={{ email: '' }}
          validationSchema={ForgotPasswordSchema}
          onSubmit={handleForgot}
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

              <View className="mt-2">
                <Button
                  label="Enviar enlace"
                  onPress={() => handleSubmit()}
                  loading={isSubmitting || isPending}
                />
              </View>
            </View>
          )}
        </Formik>

        {successMessage && (
          <View className="mt-4 bg-zinc-900 border border-zinc-700 rounded-xl p-4">
            <Text className="text-white text-sm text-center">{successMessage}</Text>
          </View>
        )}

        {errorMessage && (
          <View className="mt-2">
            <Text className="text-red-400 text-md text-center">{errorMessage}</Text>
          </View>
        )}

        {/* Volver al login */}
        <Pressable onPress={() => router.back()} className="mt-6 items-center">
          <Text className="text-zinc-500 text-sm">
            ← <Text className="text-white font-semibold">Volver al login</Text>
          </Text>
        </Pressable>

      </View>
    </KeyboardAvoidingView>
  );
}
