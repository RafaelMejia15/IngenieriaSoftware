import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  variant?: 'default' | 'glass';
}

export function Card({ children, className = '', variant = 'default', ...props }: CardProps) {
  const baseClasses = variant === 'glass'
    // Glassmorphism dark card
    ? 'bg-zinc-900/80 rounded-2xl p-6 border border-zinc-700/60'
    // Default dark card
    : 'bg-zinc-900 rounded-2xl p-6 border border-zinc-800';

  return (
    <View className={`${baseClasses} ${className}`} {...props}>
      {children}
    </View>
  );
}
