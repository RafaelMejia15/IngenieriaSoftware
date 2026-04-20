import { ActivityIndicator, Pressable, Text } from 'react-native';

// Props del componente — defineismos la interfaz del botón
// Esto es como las PropTypes pero con TypeScript
type ButtonProps = {
  label: string;           // Texto del botón
  onPress: () => void;     // Función al presionar (equivalente a onClick en web)
  loading?: boolean;       // Muestra spinner si está cargando
  variant?: 'primary' | 'outline' | 'ghost'; // Variantes de estilo
  disabled?: boolean;      // Deshabilita el botón
};

export function Button({
  label,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Clases por variante
  const containerClasses = {
    primary: 'bg-white rounded-xl py-4 items-center justify-center',
    outline: 'border border-zinc-600 rounded-xl py-4 items-center justify-center',
    ghost:   'rounded-xl py-4 items-center justify-center',
  }[variant];

  const textClasses = {
    primary: 'text-zinc-950 font-semibold text-base',
    outline: 'text-white font-semibold text-base',
    ghost:   'text-zinc-400 font-semibold text-base',
  }[variant];

  return (
    /*
      Pressable es el componente interactivo más moderno de React Native.
      Equivale a <button> en HTML pero con más control sobre estados de presión.
      - onPress = onClick
      - disabled = disabled
      - style recibe una función que da acceso al estado "pressed" para feedback visual
    */
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${containerClasses} ${isDisabled ? 'opacity-50' : ''}`}
      // feedback táctil: se puede agregar animación aquí con Animated o Reanimated
    >
      {loading ? (
        // ActivityIndicator = spinner de carga nativo (no existe en HTML, se simula con CSS)
        <ActivityIndicator
          color={variant === 'primary' ? '#09090b' : '#ffffff'}
          size="small"
        />
      ) : (
        <Text className={textClasses}>{label}</Text>
      )}
    </Pressable>
  );
}
