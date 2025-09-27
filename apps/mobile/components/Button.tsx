import { forwardRef } from 'react'
import { Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native'
import { cn } from '~/lib/utils'

type ButtonProps = {
  title: string
} & TouchableOpacityProps

export const Button = forwardRef<View, ButtonProps>(({ title, ...touchableProps }, ref) => {
  return (
    <TouchableOpacity
      ref={ref}
      {...touchableProps}
      className={cn('items-center bg-indigo-500 rounded-[28px] shadow-md p-4', touchableProps.className)}>
      <Text className='text-white text-lg font-semibold text-center'>{title}</Text>
    </TouchableOpacity>
  )
})
