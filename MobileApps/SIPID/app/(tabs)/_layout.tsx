import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="hub/index" options={{ title: 'Hub' }} />
      <Tabs.Screen name="convocatorias/index" options={{ title: 'Convocatorias' }} />
      <Tabs.Screen name="nueva-convocatoria/index" options={{ title: 'Nueva Convocatoria' }} />
    </Tabs>
  );
}

