import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type HeaderProps = {
  title?: string;
  showBack?: boolean;
  showHub?: boolean;
};

export function Header({ title, showBack = true, showHub = true }: HeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-surface-100">
      <View className="flex-row items-center gap-4">
        {showBack && (
          <Pressable
            onPress={() => router.back()}
            className="p-2 -ml-2 active:opacity-50"
          >
            <Text className="text-brand-600 font-bold text-lg">←</Text>
          </Pressable>
        )}
        {title && (
          <Text className="text-surface-900 font-bold text-xl">{title}</Text>
        )}
      </View>

      {showHub && (
        <Pressable
          onPress={() => router.push('/(tabs)/hub')}
          className="bg-brand-50 px-4 py-2 rounded-full active:bg-brand-100"
        >
          <Text className="text-brand-700 font-bold text-sm">Hub</Text>
        </Pressable>
      )}
    </View>
  );
}
