import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { useCrearConvocatoriaMutation } from '@/features/vacantes/api/vacantesMutations';
import { useCatalogoRequisitosQuery } from '@/features/vacantes/api/vacantesQueries';
import { CatalogoRequisito } from '@/types/vacantes.types';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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

const NuevaConvocatoriaSchema = Yup.object().shape({
  nombre: Yup.string()
    .min(1, 'El nombre es requerido')
    .max(2000, 'Máximo 2000 caracteres')
    .required('El nombre es requerido'),
  fecha_inicio: Yup.string().required('La fecha de inicio es requerida'),
  fecha_fin: Yup.string()
    .required('La fecha de fin es requerida')
    .test('fecha-valida', 'La fecha fin debe ser posterior a la fecha inicio', function (value) {
      const { fecha_inicio } = this.parent;
      if (!fecha_inicio || !value) return true;
      return new Date(value) > new Date(fecha_inicio);
    }),
  requisito_ids: Yup.array()
    .of(Yup.string().required())
    .min(1, 'Selecciona al menos un requisito')
    .required(),
});

// ─── Selector de Requisitos ───────────────────────────────────────────────────
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
    <View className="gap-1">
      <Text className="text-zinc-500 text-sm font-medium mb-1">Requisitos obligatorios</Text>
      {requisitos.map((req) => {
        const isSelected = selected.includes(req.id);
        return (
          <Pressable
            key={req.id}
            onPress={() => onToggle(req.id)}
            className={`flex-row items-center p-4 rounded-xl border mb-2 ${
              isSelected ? 'bg-zinc-900 border-zinc-900' : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <View
              className={`w-5 h-5 rounded border mr-3 items-center justify-center ${
                isSelected ? 'bg-white border-white' : 'border-zinc-300'
              }`}
            >
              {isSelected && <Text className="text-zinc-900 text-xs font-bold">✓</Text>}
            </View>
            <View className="flex-1">
              <Text className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                {req.codigo}
              </Text>
              <Text className={`text-xs mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {req.nombre}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
    </View>
  );
}

// ─── DatePicker Field ─────────────────────────────────────────────────────────
function DatePickerField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  const date = value ? new Date(value) : new Date();

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (selected) {
      onChange(selected.toISOString());
    }
  };

  return (
    <View className="gap-1">
      <Text className="text-zinc-500 text-sm font-medium mb-1">{label}</Text>
      <Pressable
        onPress={() => setShow(true)}
        className={`border rounded-xl px-4 py-4 bg-zinc-50 ${
          error ? 'border-red-500' : 'border-zinc-200'
        }`}
      >
        <Text className={value ? 'text-zinc-900 text-base' : 'text-zinc-400 text-base'}>
          {value ? new Date(value).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric',
          }) : 'Seleccionar fecha'}
        </Text>
      </Pressable>
      {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={new Date()}
        />
      )}
    </View>
  );
}

// ─── Pantalla Principal ────────────────────────────────────────────────────────
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
  }) => {
    try {
      const result = await crear(values);
      setSuccessMessage(`Convocatoria "${result.nombre}" creada exitosamente.`);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Error al crear la convocatoria. Verifica los datos.');
      setSuccessMessage(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>

          {/* Encabezado */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-zinc-900 tracking-tight">
              Nueva Convocatoria
            </Text>
            <Text className="text-sm text-zinc-500 mt-1">
              Completa los datos para publicar una vacante
            </Text>
          </View>

          {loadingCatalogo ? (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator color="#18181b" />
              <Text className="text-zinc-400 text-sm mt-4">Cargando catálogo...</Text>
            </View>
          ) : (
            <Formik
              initialValues={{
                nombre: '',
                fecha_inicio: '',
                fecha_fin: '',
                requisito_ids: [] as string[],
              }}
              validationSchema={NuevaConvocatoriaSchema}
              onSubmit={handleSubmit}
            >
              {({ values, errors, touched, handleChange, setFieldTouched, setFieldValue, handleSubmit: submit, isSubmitting }) => (
                <View className="gap-5">
                  <InputField
                    label="Nombre de la convocatoria"
                    placeholder="Ej. Vacante Ingeniería de Software 2025"
                    value={values.nombre}
                    onChangeText={handleChange('nombre')}
                    onBlur={() => setFieldTouched('nombre', true)}
                    error={touched.nombre && errors.nombre ? errors.nombre : undefined}
                  />

                  <DatePickerField
                    label="Fecha de inicio"
                    value={values.fecha_inicio}
                    onChange={(iso) => setFieldValue('fecha_inicio', iso)}
                    error={touched.fecha_inicio && errors.fecha_inicio ? errors.fecha_inicio : undefined}
                  />

                  <DatePickerField
                    label="Fecha de cierre"
                    value={values.fecha_fin}
                    onChange={(iso) => setFieldValue('fecha_fin', iso)}
                    error={touched.fecha_fin && errors.fecha_fin ? errors.fecha_fin : undefined}
                  />

                  <RequisitoSelector
                    requisitos={catalogo ?? []}
                    selected={values.requisito_ids}
                    onToggle={(id) => {
                      const current = values.requisito_ids;
                      const next = current.includes(id)
                        ? current.filter((r) => r !== id)
                        : [...current, id];
                      setFieldValue('requisito_ids', next);
                    }}
                    error={touched.requisito_ids && errors.requisito_ids
                      ? (errors.requisito_ids as string)
                      : undefined
                    }
                  />

                  {successMessage && (
                    <View className="bg-zinc-100 border border-zinc-200 rounded-xl p-4">
                      <Text className="text-zinc-900 text-sm text-center">{successMessage}</Text>
                    </View>
                  )}

                  {errorMessage && (
                    <Text className="text-red-500 text-sm text-center">{errorMessage}</Text>
                  )}

                  <View className="mb-8">
                    <Button
                      label="Crear convocatoria"
                      onPress={() => submit()}
                      loading={isSubmitting || isPending}
                    />
                  </View>
                </View>
              )}
            </Formik>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
