import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { useCrearConvocatoriaMutation } from '@/features/vacantes/api/vacantesMutations';
import { useCatalogoRequisitosQuery } from '@/features/vacantes/api/vacantesQueries';
import { CatalogoRequisito } from '@/types/vacantes.types';
import { Formik } from 'formik';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Yup from 'yup';
import { Header } from '@/components/ui/Header';

const NuevaConvocatoriaSchema = Yup.object().shape({
  nombre: Yup.string().min(1, 'El nombre es requerido').max(2000, 'Máximo 2000 caracteres').required('El nombre es requerido'),
  fecha_inicio: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'El formato debe ser AAAA-MM-DD').required('La fecha de inicio es requerida'),
  fecha_fin: Yup.string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'El formato debe ser AAAA-MM-DD')
    .required('La fecha de fin es requerida')
    .test('fecha-valida', 'La fecha fin debe ser posterior a la fecha inicio', function (value) {
      const { fecha_inicio } = this.parent;
      if (!fecha_inicio || !value) return true;
      return new Date(value) > new Date(fecha_inicio);
    }),
  requisito_ids: Yup.array().of(Yup.string().required()).min(1, 'Selecciona al menos un requisito').required(),
});

function RequisitoSelector({
  requisitos,
  selected,
  onToggle,
  error,
}: {
  requisitos: CatalogoRequisito[];
  selected: string[];
  onToggle: (id: string) => void;
  error?: string;
}) {
  return (
    <View className="mt-4 mb-2">
      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">
        Requisitos Obligatorios
      </Text>
      <View className="gap-3">
        {requisitos.map((req) => {
          const isSelected = selected.includes(req.id);
          return (
            <Pressable
              key={req.id}
              onPress={() => onToggle(req.id)}
              className={`flex-row items-center p-4 md:p-5 rounded-2xl border transition-all ${isSelected
                ? 'bg-purple-600/20 border-purple-500/60'
                : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                }`}
            >
              <View
                className={`w-6 h-6 rounded-lg border mr-4 items-center justify-center transition-colors ${isSelected ? 'bg-purple-600 border-purple-500' : 'border-zinc-700 bg-zinc-900'
                  }`}
              >
                {isSelected && <Text className="text-white text-sm font-bold">✓</Text>}
              </View>
              <View className="flex-1">
                <Text className={`font-bold text-base ${isSelected ? 'text-purple-300' : 'text-zinc-200'}`}>
                  {req.codigo}
                </Text>
                <Text className={`text-sm mt-1 leading-relaxed ${isSelected ? 'text-purple-400/80' : 'text-zinc-500'}`}>
                  {req.nombre}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {error && <Text className="text-red-400 text-sm font-medium mt-2">{error}</Text>}
    </View>
  );
}

export default function NuevaConvocatoriaScreen() {
  const { data: catalogo, isLoading: loadingCatalogo } = useCatalogoRequisitosQuery();
  const { mutateAsync: crear, isPending } = useCrearConvocatoriaMutation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: {
    nombre: string;
    fecha_inicio: string;
    fecha_fin: string;
    requisito_ids: string[];
  }, { resetForm }: any) => {
    try {
      const payload = {
        ...values,
        fecha_inicio: `${values.fecha_inicio}T00:00:00Z`,
        fecha_fin: `${values.fecha_fin}T23:59:59Z`,
      };
      const result = await crear(payload);
      setSuccessMessage(`¡Convocatoria "${result.nombre}" creada exitosamente!`);
      setErrorMessage(null);
      resetForm();
    } catch {
      setErrorMessage('Ocurrió un error al crear la convocatoria. Por favor, verifica los datos e intenta de nuevo.');
      setSuccessMessage(null);
    }
  };

  // Shared date input label style
  const dateLabelClass = "text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2";
  const dateInputClass = (hasError: boolean) =>
    `w-full px-5 py-4 rounded-2xl border transition-all text-base font-medium input-dark ${hasError
      ? 'border-red-500/60 text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20'
      : 'border-zinc-800 text-zinc-50 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
    }`;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-zinc-950">
      <Header title="Nueva Convocatoria" showBack={false} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-3xl mx-auto px-6 py-8 md:py-12 flex-grow">

            {/* Hero Section */}
            <View className="mb-8">
              <Text className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">
                Administración · Publicar
              </Text>
              <Text className="text-4xl md:text-5xl font-bold text-zinc-50 tracking-tight mb-2">
                Publicar Vacante
              </Text>
              <Text className="text-base text-zinc-400 font-medium">
                Configura los detalles, fechas y requisitos obligatorios para la nueva convocatoria.
              </Text>
            </View>

            {loadingCatalogo ? (
              <View className="flex-1 justify-center items-center py-32 bg-zinc-900 border border-zinc-800 rounded-3xl">
                <ActivityIndicator color="#8b5cf6" size="large" />
                <Text className="text-zinc-500 font-bold text-xs mt-4 uppercase tracking-widest">
                  Cargando catálogo...
                </Text>
              </View>
            ) : (
              <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-10">
                <Formik
                  initialValues={{ nombre: '', fecha_inicio: '', fecha_fin: '', requisito_ids: [] as string[] }}
                  validationSchema={NuevaConvocatoriaSchema}
                  onSubmit={handleSubmit}
                >
                  {({ values, errors, touched, handleChange, setFieldTouched, setFieldValue, handleSubmit: submit, isSubmitting }) => (
                    <View className="gap-6">

                      <InputField
                        label="Nombre de la convocatoria"
                        placeholder="Ej. Vacante Ingeniería de Software 2025"
                        value={values.nombre}
                        onChangeText={handleChange('nombre')}
                        onBlur={() => setFieldTouched('nombre', true)}
                        error={touched.nombre && errors.nombre ? errors.nombre : undefined}
                      />

                      <View className="flex-col md:flex-row gap-6">
                        {/* Fecha de Inicio */}
                        <View className="flex-1">
                          {Platform.OS === 'web' ? (
                            <View className="gap-2">
                              <Text className={dateLabelClass}>Fecha de inicio</Text>
                              <input
                                type="date"
                                value={values.fecha_inicio}
                                onChange={(e) => setFieldValue('fecha_inicio', e.target.value)}
                                onBlur={() => setFieldTouched('fecha_inicio', true)}
                                className={dateInputClass(!!(touched.fecha_inicio && errors.fecha_inicio))}
                              />
                              {touched.fecha_inicio && errors.fecha_inicio && (
                                <Text className="text-red-400 text-xs font-medium">{errors.fecha_inicio}</Text>
                              )}
                            </View>
                          ) : (
                            <InputField
                              label="Fecha de inicio (AAAA-MM-DD)"
                              placeholder="Ej. 2025-06-01"
                              value={values.fecha_inicio}
                              onChangeText={handleChange('fecha_inicio')}
                              onBlur={() => setFieldTouched('fecha_inicio', true)}
                              error={touched.fecha_inicio && errors.fecha_inicio ? errors.fecha_inicio : undefined}
                            />
                          )}
                        </View>

                        {/* Fecha de Cierre */}
                        <View className="flex-1">
                          {Platform.OS === 'web' ? (
                            <View className="gap-2">
                              <Text className={dateLabelClass}>Fecha de cierre</Text>
                              <input
                                type="date"
                                value={values.fecha_fin}
                                onChange={(e) => setFieldValue('fecha_fin', e.target.value)}
                                onBlur={() => setFieldTouched('fecha_fin', true)}
                                className={dateInputClass(!!(touched.fecha_fin && errors.fecha_fin))}
                              />
                              {touched.fecha_fin && errors.fecha_fin && (
                                <Text className="text-red-400 text-xs font-medium">{errors.fecha_fin}</Text>
                              )}
                            </View>
                          ) : (
                            <InputField
                              label="Fecha de cierre (AAAA-MM-DD)"
                              placeholder="Ej. 2025-06-30"
                              value={values.fecha_fin}
                              onChangeText={handleChange('fecha_fin')}
                              onBlur={() => setFieldTouched('fecha_fin', true)}
                              error={touched.fecha_fin && errors.fecha_fin ? errors.fecha_fin : undefined}
                            />
                          )}
                        </View>
                      </View>

                      {/* Divisor */}
                      <View className="h-[1px] bg-zinc-800 my-2" />

                      {/* Selector de Requisitos */}
                      <RequisitoSelector
                        requisitos={catalogo ?? []}
                        selected={values.requisito_ids}
                        onToggle={(id) => {
                          const current = values.requisito_ids;
                          const next = current.includes(id) ? current.filter((r) => r !== id) : [...current, id];
                          setFieldValue('requisito_ids', next);
                        }}
                        error={touched.requisito_ids && errors.requisito_ids ? (errors.requisito_ids as string) : undefined}
                      />

                      {/* Banners de Respuesta */}
                      {successMessage && (
                        <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 mt-4">
                          <Text className="text-emerald-400 font-bold text-base mb-1">¡Operación exitosa!</Text>
                          <Text className="text-emerald-400/80 text-sm">{successMessage}</Text>
                        </View>
                      )}

                      {errorMessage && (
                        <View className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mt-4">
                          <Text className="text-red-400 font-bold text-base mb-1">Hubo un problema</Text>
                          <Text className="text-red-400/80 text-sm">{errorMessage}</Text>
                        </View>
                      )}

                      {/* Botón de Submit */}
                      <View className="mt-4 pt-6 border-t border-zinc-800">
                        <Button
                          label="Publicar convocatoria"
                          onPress={() => submit()}
                          loading={isSubmitting || isPending}
                        />
                      </View>

                    </View>
                  )}
                </Formik>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}