import { useAudioPlayer } from 'expo-audio'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { ActionSheetIOS, FlatList, Text, View } from 'react-native'

import { API } from '../../server/src/lib'
import { Button } from './Button'

export const ScreenContent = () => {
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const player = useAudioPlayer(require('../assets/sounds/success.m4a'))

  const uploadReceipt = async (asset: ImagePicker.ImagePickerAsset): Promise<void> => {
    setBusy(true)
    setResult(undefined)

    const form = new FormData()
    form.append('image', {
      uri: asset.uri,
      name: asset.fileName ?? 'receipt.jpg',
      type: asset.mimeType ?? 'image/jpeg'
    } as any)

    try {
      const res = await fetch(process.env.EXPO_PUBLIC_API_URL + API.SCAN_RECEIPT, {
        method: 'POST',
        body: form
      })

      console.log(res)

      if (!res.ok) {
        const message = ['Upload failed', res.status, res.statusText]
        console.log(...message)
        alert(message.join('\n'))
        return
      }

      const data = await res.json()
      player.play()
      setResult(data)
    } catch (err) {
      console.error('Upload error', err)
      alert(`Upload failed\n${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') return alert('Camera permission denied')

    const shot = await ImagePicker.launchCameraAsync({
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images
    })

    if (shot.canceled) return
    await uploadReceipt(shot.assets[0])
  }

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return alert('Photo library permission denied')

    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1
    })

    if (pick.canceled) return
    await uploadReceipt(pick.assets[0])
  }

  const chooseSource = () => {
    if (busy) return
    return ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Scan receipt',
        options: ['Take Photo', 'Choose from Photos', 'Cancel'],
        cancelButtonIndex: 2
      },
      (buttonIndex) => {
        if (buttonIndex === 0) takePhoto()
        if (buttonIndex === 1) pickPhoto()
      }
    )
  }

  const renderItem = ({ item }: any) => (
    <View className='flex-col items-start mb-5'>
      <Text>Nom du produit : {item.name}</Text>
      <Text>Prix : {item.unitPrice}</Text>
      <Text>Quantité : {item.quantity}</Text>
      <Text>Unit : {item.unit}</Text>
      <Text>Amount : {item.amount}</Text>
    </View>
  )

  return (
    <View className='items-center flex-1 justify-center'>
      <View className='flex-1 items-center justify-center gap-4 p-4'>
        <Button title={busy ? 'Scanning…' : 'Scan receipt'} onPress={chooseSource} disabled={busy} />
        {result && (
          <>
            <Text>You spent {String(result.totals.paid ?? '-')} MAD</Text>
            <Text>You bought {String(result.items.length ?? '-')} items</Text>
            <Text className='mt-2 font-bold'>Items</Text>
            <FlatList data={result.items} renderItem={renderItem} keyExtractor={(item) => item.name} />
          </>
        )}
      </View>
    </View>
  )
}
