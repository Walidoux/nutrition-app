import { Stack } from 'expo-router'
import 'react-native-gesture-handler'
import '../global.css'

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
    </Stack>
  )
}
