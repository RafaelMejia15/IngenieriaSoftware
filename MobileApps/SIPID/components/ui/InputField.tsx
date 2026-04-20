import { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

type InputFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;           // Mensaje de error de Formik/Yup
  secureTextEntry?: boolean; // Para contraseñas — oculta el texto
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: KeyboardTypeOptions; // Tipo de teclado: email-address, numeric, etc.
};

export function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  onBlur,
  error,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
}: InputFieldProps) {
  // Estado local para controlar si el campo está enfocado (no existe en HTML nativo)
  const [isFocused, setIsFocused] = useState(false);
  // Estado para mostrar/ocultar contraseña
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    /*
      View es el bloque constructivo básico, como un <div>.
      No puede recibir texto directamente — solo otros componentes.
    */
    <View className="gap-1">

      {/* Etiqueta del campo */}
      <Text className="text-zinc-400 text-sm font-medium mb-1">{label}</Text>

      {/* Contenedor del input con borde dinámico según focus o error */}
      <View
        className={`
          flex-row items-center
          border rounded-xl px-4 bg-zinc-900
          ${error ? 'border-red-500' : isFocused ? 'border-zinc-400' : 'border-zinc-800'}
        `}
      >
        {/*
          TextInput es el equivalente a <input> en HTML.
          Diferencias clave:
          - No existe onFocus/onBlur nativo en el div, aquí sí en TextInput
          - secureTextEntry oculta el texto (como type="password" en HTML)
          - keyboardType controla qué teclado virtual muestra el SO
          - autoCapitalize controla la capitalización automática del teclado
        */}
        <TextInput
          className="flex-1 text-white py-4 text-base"
          placeholder={placeholder}
          placeholderTextColor="#52525b" // zinc-600 — no se puede hacer con className en RN
          value={value}
          onChangeText={onChangeText}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          onFocus={() => setIsFocused(true)}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoCorrect={false}
        />

        {/* Botón para mostrar/ocultar contraseña */}
        {secureTextEntry && (
          <Pressable onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
            <Text className="text-zinc-500 text-sm ml-2">
              {isPasswordVisible ? 'Ocultar' : 'Ver'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Mensaje de error de Formik — solo se muestra si hay error y el campo fue tocado */}
      {error && (
        <Text className="text-red-400 text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
