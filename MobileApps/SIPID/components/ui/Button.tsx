import { ActivityIndicator, Pressable, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'glass';
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerClasses = {
    primary: 'bg-gray-700 active:bg-gray-800 shadow-md rounded-xl py-4 items-center justify-center border border-gray-600/50',
    outline: 'bg-surface-50 active:bg-surface-100 border border-surface-300 shadow-sm rounded-xl py-4 items-center justify-center',
    ghost: 'active:bg-surface-100/50 rounded-xl py-4 items-center justify-center',
    glass: 'glass active:bg-white/90 rounded-xl py-4 items-center justify-center',
  }[variant];

  const textClasses = {
    primary: 'text-white font-semibold text-base tracking-wide',
    outline: 'text-surface-700 font-semibold text-base tracking-wide',
    ghost: 'text-surface-500 font-medium text-base tracking-wide',
    glass: 'text-brand-700 font-semibold text-base tracking-wide',
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`hover:bg-gray-600  ${containerClasses} ${isDisabled ? 'opacity-50' : ''}`}
      style={({ pressed }) => ({
        transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
      })}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#ffffff' : '#3b82f6'}
          size="small"
        />
      ) : (
        <Text className={textClasses}>{label}</Text>
      )}
    </Pressable>
  );
}
