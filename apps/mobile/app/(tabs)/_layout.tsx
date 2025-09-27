import { Tabs } from 'expo-router'
import 'react-native-gesture-handler'
import FloatingTabBar from '~/components/FloatingTabBar'

export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <FloatingTabBar {...p} />}>
      <Tabs.Screen name='scan' options={{ title: 'Scan' }} />
      <Tabs.Screen name='groceries' options={{ title: 'Groceries' }} />
      <Tabs.Screen name='budgets' options={{ title: 'Budgets' }} />
    </Tabs>
  )
}
