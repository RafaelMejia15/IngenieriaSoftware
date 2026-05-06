import { ActivityIndicator, Pressable, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
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
    primary: 'bg-zinc-900 rounded-xl py-4 items-center justify-center',
    outline: 'border border-zinc-300 rounded-xl py-4 items-center justify-center',
    ghost:   'rounded-xl py-4 items-center justify-center',
  }[variant];

  const textClasses = {
    primary: 'text-white font-semibold text-base',
    outline: 'text-zinc-900 font-semibold text-base',
    ghost:   'text-zinc-500 font-semibold text-base',
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${containerClasses} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#ffffff' : '#18181b'}
          size="small"
        />
      ) : (
        <Text className={textClasses}>{label}</Text>
      )}
    </Pressable>
  );
}
