import { Text, View, ViewProps } from 'react-native';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  className?: string;
}

export function Badge({ label, variant = 'default', className = '', ...props }: BadgeProps) {
  // Dark-mode badge palette: translucent colored backgrounds
  const styles = {
    success: { container: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400' },
    warning: { container: 'bg-amber-500/15 border-amber-500/30',   text: 'text-amber-400'   },
    error:   { container: 'bg-red-500/15 border-red-500/30',       text: 'text-red-400'     },
    info:    { container: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400'  },
    default: { container: 'bg-zinc-800 border-zinc-700',           text: 'text-zinc-400'    },
  }[variant];

  return (
    <View
      className={`self-start px-2.5 py-1 rounded-full border ${styles.container} ${className}`}
      {...props}
    >
      <Text className={`text-xs font-bold uppercase tracking-wider ${styles.text}`}>
        {label}
      </Text>
    </View>
  );
}
