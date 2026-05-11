import { useState } from 'react';
import {
  KeyboardTypeOptions,
  Platform,
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
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: KeyboardTypeOptions;
  type?: string;
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
  type,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Truco para react-native-web: pasar atributos nativos de HTML
  const webProps = Platform.OS === 'web' && type ? { type } : {};

  return (
    <View className="gap-1.5 mb-2">
      <Text className="text-surface-700 text-sm font-semibold ml-1">{label}</Text>

      <View
        className={`
          flex-row items-center
          border rounded-xl px-4 bg-white shadow-sm transition-all
          ${error ? 'border-red-400 bg-red-50' : isFocused ? 'border-brand-500 ring-2 ring-brand-100' : 'border-surface-200'}
        `}
      >
        <TextInput
          className="flex-1 text-surface-900 py-3.5 text-base"
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
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
          {...(webProps as any)}
          style={Platform.OS === 'web' ? { outline: 'none' } as any : undefined}
        />

        {secureTextEntry && (
          <Pressable onPress={() => setIsPasswordVisible(!isPasswordVisible)} className="p-2 -mr-2">
            <Text className="text-brand-600 font-medium text-sm">
              {isPasswordVisible ? 'Ocultar' : 'Ver'}
            </Text>
          </Pressable>
        )}
      </View>

      {error && (
        <Text className="text-red-500 text-xs mt-0.5 ml-1 font-medium">{error}</Text>
      )}
    </View>
  );
}
