import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ProfileDropdown } from './ProfileDropdown';

type HeaderProps = {
  title?: string;
  showBack?: boolean;
  showHub?: boolean;
};

export function Header({ title, showBack = true, showHub = true }: HeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-800 z-50">
      <View className="flex-row items-center gap-4">
        {showBack && (
          <Pressable
            onPress={() => router.back()}
            className="p-2 -ml-2 active:opacity-50"
          >
            <Text className="text-purple-400 font-bold text-lg">←</Text>
          </Pressable>
        )}
        {title && (
          <Text className="text-zinc-50 font-bold text-xl tracking-tight">{title}</Text>
        )}
      </View>

      <View className="flex-row items-center gap-3">
        {showHub && (
          <Pressable
            onPress={() => router.push('/(tabs)/hub')}
            className="bg-purple-600/20 border border-purple-500/40 px-4 py-2 rounded-full active:bg-purple-600/40 hover:bg-purple-600/30 mr-2"
          >
            <Text className="text-purple-400 font-bold text-sm">Hub</Text>
          </Pressable>
        )}
        <ProfileDropdown />
      </View>
    </View>
  );
}
