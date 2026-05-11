import { Text, View, ViewProps } from 'react-native';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  className?: string;
}

export function Badge({ label, variant = 'default', className = '', ...props }: BadgeProps) {
  const colors = {
    success: 'bg-green-100 border-green-200 text-green-700',
    warning: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    error: 'bg-red-100 border-red-200 text-red-700',
    info: 'bg-brand-100 border-brand-200 text-brand-700',
    default: 'bg-surface-100 border-surface-200 text-surface-600',
  };

  const selectedColors = colors[variant];

  return (
    <View className={`self-start px-2.5 py-1 rounded-full border ${selectedColors.split(' ').slice(0,2).join(' ')} ${className}`} {...props}>
      <Text className={`text-xs font-semibold uppercase tracking-wider ${selectedColors.split(' ')[2]}`}>
        {label}
      </Text>
    </View>
  );
}
