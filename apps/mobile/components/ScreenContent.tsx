import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from './Button';

type ScreenContentProps = {
  title: string;
  path: string;
  children?: React.ReactNode;
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL!;

export const ScreenContent = ({ title, path, children }: ScreenContentProps) => {
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return alert('Camera permission denied');

    const shot = await ImagePicker.launchCameraAsync({
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (shot.canceled) return;
    setBusy(true);

    const asset = shot.assets[0];
    const form = new FormData();

    form.append('image', {
      uri: asset.uri,
      name: asset.fileName ?? 'receipt.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as any);

    console.log(`Uploading receipt to ${apiUrl}/ocr/receipt`, shot.assets[0]);
    const res = await fetch(`${apiUrl}/ocr/receipt`, {
      method: 'POST',
      body: form,
    });

    const data = await res.json();

    if (!res.ok) {
      const message = ['Upload failed', res.status, res.statusText, data];
      console.log(...message);
      setBusy(false);
      return alert(message.join('\n'));
    }

    console.log(data);
    setResult(data);
    setBusy(false);
  };

  return (
    <View className={styles.container}>
      <Text className={styles.title}>{title}</Text>
      <View className={styles.separator} />
      <View className="flex-1 items-center justify-center gap-4 p-4">
        <Button title={busy ? 'Scanning…' : 'Scan receipt'} onPress={takePhoto} disabled={busy} />
        {result?.parsed && (
          <ScrollView className="mt-4 max-h-80 w-full">
            <Text>Merchant: {result.parsed.merchant ?? '-'}</Text>
            <Text>
              Date/Time: {result.parsed.date ?? '-'} {result.parsed.time ?? ''}
            </Text>
            <Text>Subtotal: {String(result.parsed.subtotal ?? '-')}</Text>
            <Text>Tax: {String(result.parsed.tax ?? '-')}</Text>
            <Text>Total: {String(result.parsed.total ?? '-')}</Text>
            <Text className="mt-2 font-bold">Items</Text>
            {result.parsed.items?.map((it: any, i: number) => (
              <Text key={i}>
                {it.name} — {it.price}
              </Text>
            ))}
          </ScrollView>
        )}
      </View>

      {children}
    </View>
  );
};
const styles = {
  container: `items-center flex-1 justify-center`,
  separator: `h-[1px] my-7 w-4/5 bg-gray-200`,
  title: `text-xl font-bold`,
};
