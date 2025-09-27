import { SafeAreaView } from 'react-native-safe-area-context'

export const Container = ({ children }: { children: React.ReactNode }) => {
  return <SafeAreaView className='flex flex-1 m-6'>{children}</SafeAreaView>
}
