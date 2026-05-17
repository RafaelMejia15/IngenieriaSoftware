import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'glass';
  disabled?: boolean;
  icon?: React.ReactNode;
};

export function Button({
  label,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerClasses = {
    // Vibrant purple primary button
    primary: 'bg-purple-600 active:bg-purple-500 hover:bg-purple-500 shadow-lg rounded-xl py-4 items-center justify-center border border-purple-500/50',
    // Transparent with purple border
    outline: 'bg-transparent active:bg-zinc-800 border border-zinc-700 hover:border-purple-500 rounded-xl py-4 items-center justify-center',
    // Ghost with subtle hover
    ghost: 'active:bg-zinc-800/50 hover:bg-zinc-800/30 rounded-xl py-4 items-center justify-center',
    // Glassmorphism dark
    glass: 'bg-zinc-900/80 border border-zinc-700 active:bg-zinc-800 rounded-xl py-4 items-center justify-center',
  }[variant];

  const textClasses = {
    primary: 'text-white font-medium text-base tracking-wide',
    outline: 'text-zinc-50 font-medium text-base tracking-wide',
    ghost: 'text-zinc-400 font-medium text-base tracking-wide',
    glass: 'text-purple-400 font-medium text-base tracking-wide',
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`p-2 ${containerClasses} ${isDisabled ? 'opacity-40' : ''}`}
      style={({ pressed }) => ({
        transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
      })}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#ffffff' : '#8b5cf6'}
          size="small"
        />
      ) : (
        <View className="flex-row space-x-2 items-center">
          {icon}
          <Text className={textClasses}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
