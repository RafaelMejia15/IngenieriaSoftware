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
  testID?: string;
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
  testID,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Truco para react-native-web: pasar atributos nativos de HTML
  const webProps = Platform.OS === 'web' && type ? { type } : {};

  return (
    <View className="gap-1.5 mb-2">
      {/* Label: uppercase tracking-widest micro-copy style */}
      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest ml-1">
        {label}
      </Text>

      <View
        className={`
          flex-row items-center
          border rounded-xl px-4 bg-zinc-950 transition-all
          ${error
            ? 'border-red-500/70'
            : isFocused
            ? 'border-purple-500'
            : 'border-zinc-800'
          }
        `}
        style={isFocused && Platform.OS === 'web'
          ? { boxShadow: '0 0 0 1px #8b5cf6' } as any
          : undefined}
      >
        <TextInput
          className="flex-1 text-zinc-50 py-3.5 text-base"
          placeholder={placeholder}
          placeholderTextColor="#52525b"
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
          testID={testID}
          {...(webProps as any)}
          style={Platform.OS === 'web' ? { outline: 'none', color: '#fafafa' } as any : undefined}
        />

        {secureTextEntry && (
          <Pressable onPress={() => setIsPasswordVisible(!isPasswordVisible)} className="p-2 -mr-2">
            <Text className="text-purple-400 font-medium text-sm">
              {isPasswordVisible ? 'Ocultar' : 'Ver'}
            </Text>
          </Pressable>
        )}
      </View>

      {error && (
        <Text className="text-red-400 text-xs mt-0.5 ml-1 font-medium">{error}</Text>
      )}
    </View>
  );
}
