import { Text, View, Pressable } from 'react-native';

type SelectOption = {
  label: string;
  value: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
};

export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
}: SelectFieldProps) {
  return (
    <View className="gap-1">
      {/* Micro-copy label: uppercase + tracking-widest */}
      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1 ml-1">
        {label}
      </Text>

      <View className="flex-row gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              className={`
                flex-1 py-4 rounded-xl items-center justify-center border transition-all
                ${isSelected
                  ? 'bg-purple-600 border-purple-500'
                  : 'bg-zinc-900 border-zinc-700 hover:border-purple-500/50'
                }
              `}
            >
              <Text
                className={`font-bold text-base ${
                  isSelected ? 'text-white' : 'text-zinc-400'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text>
      )}
    </View>
  );
}
