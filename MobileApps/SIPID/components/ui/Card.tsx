import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  variant?: 'default' | 'glass';
}

export function Card({ children, className = '', variant = 'default', ...props }: CardProps) {
  const baseClasses = variant === 'glass' 
    ? 'glass rounded-2xl p-6' 
    : 'bg-white rounded-2xl p-6 border border-surface-200 shadow-sm';
    
  return (
    <View className={`${baseClasses} ${className}`} {...props}>
      {children}
    </View>
  );
}
