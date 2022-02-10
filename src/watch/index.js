import * as React from 'react';
import {Text, View, TextInput, StyleSheet, Button} from 'react-native';
import {useState, useCallback} from 'react';
import {RTCView} from 'react-native-webrtc';
import {engineInst} from './watch-engine'
import {useEffect} from 'react';

export default function WatchingScreen() {
    const [address, setAddress] = useState();
    const [engine] = useState(engineInst);
    const [streamUrl, setStreamUrl] = useState(engine.streamUrl);

    const connect = useCallback(() => {
        engine.joinStream("f3d451bb-927b-49a9-947e-4f5f616576d9");
    }, [engine, address])

    const onChangeText = useCallback(text => {
        setAddress(text)
    }, [setAddress])

    useEffect(() => {
        // console.log('watch url', engine.streamUrl);
        // setStreamUrl(engine.streamUrl);
        engine.onUrl = (url) => {
            console.log('dispatchEvent received!!', url)
            setStreamUrl(url)
        }
    }, [setStreamUrl, engine])

    console.log('play stream', streamUrl)
    return (
        <View style={styles.container}>
            <Text style={styles.hint}>Enter stream id!</Text>
            <TextInput style={styles.textInput} onChangeText={onChangeText} />
            <Button style={styles.button} title={"Connect"} onPress={connect} />
            <RTCView style={styles.stream} streamURL={streamUrl}/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: 'white'
    },
    hint: {
        marginTop: 40,
        marginBottom: 20,
    },
   textInput: {
       width: 300,
       height: 40,
       borderWidth: 1,
       padding: 10,
       marginBottom: 20
   },
    stream: {
        flex: 1,
        width: '100%',
        backgroundColor: 'red'
    }
});
