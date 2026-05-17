import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';

export default function TabsLayout() {
  const content = (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="hub/index" options={{ title: 'Hub' }} />
      <Tabs.Screen name="convocatorias/index" options={{ title: 'Convocatorias' }} />
      <Tabs.Screen name="nueva-convocatoria/index" options={{ title: 'Nueva Convocatoria' }} />
    </Tabs>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#09090b' } as any}>
        {content}
      </View>
    );
  }

  return content;
}
