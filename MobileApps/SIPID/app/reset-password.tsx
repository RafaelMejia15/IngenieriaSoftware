import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { useResetPasswordMutation } from '@/features/index/api/authMutation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Formik } from 'formik';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import * as Yup from 'yup';

const ResetPasswordSchema = Yup.object().shape({
  new_password: Yup.string()
    .min(6, 'Mínimo 6 caracteres')
    .required('La contraseña es requerida'),
});

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { mutateAsync: resetAction, isPending } = useResetPasswordMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async (values: { new_password: string }) => {
    if (!token) {
      setErrorMessage('Token inválido. Solicita un nuevo enlace.');
      return;
    }

    try {
      await resetAction({ token, new_password: values.new_password });
      router.replace('/');
    } catch {
      setErrorMessage('No se pudo actualizar la contraseña. El enlace puede haber expirado.');
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
            Nueva contraseña
          </Text>
          <Text className="text-sm text-zinc-400 mt-1">
            Ingresa tu nueva contraseña para continuar
          </Text>
        </View>

        <Formik
          initialValues={{ new_password: '' }}
          validationSchema={ResetPasswordSchema}
          onSubmit={handleReset}
        >
          {({ values, errors, touched, handleChange, setFieldTouched, handleSubmit, isSubmitting }) => (
            <View className="gap-4">
              <InputField
                label="Nueva contraseña"
                placeholder="••••••••"
                value={values.new_password}
                onChangeText={handleChange('new_password')}
                onBlur={() => setFieldTouched('new_password', true)}
                error={touched.new_password && errors.new_password ? errors.new_password : undefined}
                secureTextEntry
              />

              <View className="mt-2">
                <Button
                  label="Actualizar contraseña"
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
