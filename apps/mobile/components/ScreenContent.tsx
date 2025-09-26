import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
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
    setResult(undefined)

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

  const renderItem = ({ item }: any) => (
    <View style={styles.listItem}>
      <Text style={styles.itemText}>Nom du produit : {item.name}</Text>
      <Text style={styles.itemText}>Prix : {item.price}</Text>
      <Text style={styles.itemText}>Quantité : {item.quantity}</Text>
    </View>
  );

  const styles = StyleSheet.create({
    listItem: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    bullet: {
      fontSize: 20,
      marginRight: 10,
    },
    itemText: {
      fontSize: 16,
    },
  });

  return (
    <View className={test.container}>
      <Text className={test.title}>{title}</Text>
      <View className={test.separator} />
      <View className="flex-1 items-center justify-center gap-4 p-4">
        <Button title={busy ? 'Scanning…' : 'Scan receipt'} onPress={takePhoto} disabled={busy} />
        {result?.parsed && (
          <>
            <Text>
              You spent {String(result.parsed.totals.paid ?? '-')}{' '}
              {String(result.parsed.currency ?? '??')}
            </Text>
            <Text>You bought {String(result.parsed.totals.itemsTotal ?? '-')} items</Text>
            <Text className="mt-2 font-bold">Items</Text>
            <FlatList
              data={result.parsed.items}
              renderItem={renderItem}
              keyExtractor={(item) => item.name}
            />
          </>
        )}
      </View>

      {children}
    </View>
  );
};

const test = {
  container: `items-center flex-1 justify-center`,
  separator: `h-[1px] my-7 w-4/5 bg-gray-200`,
  title: `text-xl font-bold`,
};
