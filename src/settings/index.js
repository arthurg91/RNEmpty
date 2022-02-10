import * as React from 'react';
import {useCallback, useState, useEffect} from 'react';
import {
  Text,
  View,
  TextInput,
  StyleSheet,
  Button,
  AsyncStorage,
  PermissionsAndroid,
  Platform,
} from 'react-native';

function SettingsScreen() {
  const [address, setAddress] = useState('wss://srt.tubit.com');

  const requestCameraPermission = useCallback(async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Cool Photo App Camera Permission',
          message:
            'Cool Photo App needs access to your camera ' +
            'so you can take awesome pictures.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('You can use the camera');
      } else {
        console.log('Camera permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  }, []);

  const saveAddress = useCallback(() => {
    AsyncStorage.setItem('WSS', address);
  }, [address]);

  const onChangeText = useCallback(
    text => {
      setAddress(text);
    },
    [setAddress],
  );

  useEffect(() => {
    if (Platform.OS === 'android') {
      requestCameraPermission();
    }
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: 'white',
      }}>
      <Text style={styles.hint}>Enter server address!</Text>
      <TextInput
        style={styles.textInput}
        placeholder={'192.168.0.3:8080'}
        onChangeText={onChangeText}
        value={address}
      />
      <Button
        style={styles.button}
        title={'Save address'}
        onPress={saveAddress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginTop: 40,
    marginBottom: 20,
  },
  textInput: {
    width: 300,
    height: 40,
    borderWidth: 1,
    padding: 10,
    marginBottom: 20,
  },
  button: {},
});

export default SettingsScreen;
