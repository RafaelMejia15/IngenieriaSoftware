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
    <View className="gap-1">
      <Text className="text-zinc-500 text-sm font-medium mb-1">{label}</Text>

      <View
        className={`
          flex-row items-center
          border rounded-xl px-4 bg-zinc-50
          ${error ? 'border-red-500' : isFocused ? 'border-zinc-400' : 'border-zinc-200'}
        `}
      >
        <TextInput
          className="flex-1 text-zinc-900 py-4 text-base"
          placeholder={placeholder}
          placeholderTextColor="#a1a1aa"
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
        />

        {secureTextEntry && (
          <Pressable onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
            <Text className="text-zinc-400 text-sm ml-2">
              {isPasswordVisible ? 'Ocultar' : 'Ver'}
            </Text>
          </Pressable>
        )}
      </View>

      {error && (
        <Text className="text-red-500 text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
