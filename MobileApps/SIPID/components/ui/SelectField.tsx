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
      <Text className="text-zinc-500 text-sm font-medium mb-1">{label}</Text>

      <View className="flex-row gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              className={`
                flex-1 py-4 rounded-xl items-center justify-center border
                ${isSelected
                  ? 'bg-zinc-900 border-zinc-900'
                  : 'bg-zinc-50 border-zinc-200'
                }
              `}
            >
              <Text
                className={`font-semibold text-base ${
                  isSelected ? 'text-white' : 'text-zinc-500'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <Text className="text-red-500 text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
