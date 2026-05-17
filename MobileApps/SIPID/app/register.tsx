import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { SelectField } from '@/components/ui/SelectField';
import { useRegisterMutation } from '@/features/index/api/authMutation';
import { UserRole } from '@/types/user.types';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Yup from 'yup';

const RegisterSchema = Yup.object().shape({
  email: Yup.string()
    .email('Ingresa un correo válido')
    .required('El correo es requerido'),
  password: Yup.string()
    .min(6, 'Mínimo 6 caracteres')
    .required('La contraseña es requerida'),
  rol: Yup.string()
    .oneOf(['usuario', 'admin'])
    .required('El rol es requerido'),
});

const rolOptions = [
  { label: 'Usuario', value: 'usuario' },
  { label: 'Admin', value: 'admin' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { mutateAsync: registerAction, isPending } = useRegisterMutation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async (values: {
    email: string;
    password: string;
    rol: UserRole;
  }) => {
    try {
      await registerAction(values);
      setSuccessMessage('Cuenta creada. Revisa tu correo para activarla.');
      setErrorMessage(null);
      setTimeout(() => {
        router.replace('/');
      }, 2500);
    } catch (error: any) {
      if (error.response?.status === 409) {
        setErrorMessage('La cuenta ya está registrada.');
      } else {
        setErrorMessage('Error al crear la cuenta. Intenta de nuevo.');
      }
      setSuccessMessage(null);
    }
  };

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
            <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">
              SIPID · Nueva Cuenta
            </Text>
            <Text className="text-4xl font-bold text-zinc-50 tracking-tight">
              Crear cuenta
            </Text>
            <Text className="text-sm text-zinc-400 mt-2">
              Regístrate para continuar
            </Text>
          </View>

          <Formik
            initialValues={{ email: '', password: '', rol: 'usuario' as UserRole }}
            validationSchema={RegisterSchema}
            onSubmit={handleRegister}
          >
            {({ values, errors, touched, handleChange, setFieldTouched, setFieldValue, handleSubmit, isSubmitting }) => (
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

                <SelectField
                  label="Rol"
                  value={values.rol}
                  options={rolOptions}
                  onChange={(val) => setFieldValue('rol', val)}
                  error={touched.rol && errors.rol ? errors.rol : undefined}
                />

                <View className="mt-2">
                  <Button
                    label="Crear cuenta"
                    onPress={() => handleSubmit()}
                    loading={isSubmitting || isPending}
                  />
                </View>
              </View>
            )}
          </Formik>

          {successMessage && (
            <View className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <Text className="text-emerald-400 text-sm text-center font-medium">{successMessage}</Text>
            </View>
          )}

          {errorMessage && (
            <View className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <Text className="text-red-400 text-sm text-center font-medium">{errorMessage}</Text>
            </View>
          )}

          {/* Link al Login */}
          <Pressable onPress={() => router.replace('/')} className="mt-8 items-center">
            <Text className="text-zinc-500 text-sm">
              ¿Ya tienes cuenta?{' '}
              <Text className="text-purple-400 font-semibold">Iniciar sesión</Text>
            </Text>
          </Pressable>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
