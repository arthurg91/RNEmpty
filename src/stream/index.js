import * as React from 'react';
import {View, StyleSheet, Button} from 'react-native';
import {useState, useCallback, useEffect} from 'react';
import {RTCView} from 'react-native-webrtc';
import {engineInst} from './stream-engine'

export default function StreamScreen() {
    const [title, setTitle] = useState("Start Stream!");
    const [engine] = useState(engineInst);
    const [streamUrl, setStreamUrl] = useState(engine.streamUrl);

    const startStream = useCallback(async () => {
        const streamId = await engine.startStream();
        setTitle(streamId);
    }, [engine, setTitle]);

    useEffect(() => {
        console.log('stream url', engine.streamUrl);
        setStreamUrl(engine.streamUrl);
        engine.onUrl = (url) => {
            console.log('received!!')
            setStreamUrl(url)
        }
    }, [setStreamUrl, engine])

    console.log('stream url2', streamUrl);

    return (
        <View style={styles.container}>
            <Button style={styles.button} title={title} onPress={startStream} />
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
    button: {
        marginTop: 40,
        marginBottom: 20,
    },
    stream: {
        flex: 1,
        width: '100%',
        backgroundColor: 'red'
    }
});
