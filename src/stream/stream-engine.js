import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
    MediaStream,
    MediaStreamTrack,
    mediaDevices,
    registerGlobals
} from 'react-native-webrtc';
import {AsyncStorage} from 'react-native';



export default class StreamEngine {
    candidates = [];
    streamUrl;
    pc;
    onUrl;
    offer;

    constructor() {
        this.pc = new RTCPeerConnection()
        this.pc.onicecandidate = this.onIceCandidate;
        this.pc.onicegatheringstatechange = this.onGatheringStateChange;
        console.log('123! constr')

        let dataChannel = this.pc.createDataChannel('WebRTCData')
        dataChannel.onmessage = this.onMessage;
        mediaDevices.enumerateDevices().then(sourceInfos => {
            let videoSourceId;
            for (let i = 0; i < sourceInfos.length; i++) {
                const sourceInfo = sourceInfos[i];
                if(sourceInfo.kind == "videoinput" && sourceInfo.facing == ("front")) {
                    videoSourceId = sourceInfo.deviceId;
                }
            }
            console.log('123!',videoSourceId)

            mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: 1024,
                    height: 800,
                    frameRate: 30,
                    facingMode: "user",
                    deviceId: videoSourceId
                }
            }).then(stream => {
                console.log('123stream!', stream.getTracks())

                this.pc.addStream(stream);
                this.streamUrl = stream.toURL();
                this.onUrl && this.onUrl(this.streamUrl);
                console.log('streamurl', this.streamUrl);
                this.pc.createOffer().then(async offer => {
                    console.log('offer', offer);
                    this.offer = offer;
                    await this.pc.setLocalDescription(offer)
                }).catch(e => {
                    console.log('offer e', e);

                });
            }).catch(error => {
                console.log('123!error',error)

            });
        })

    }

    onMessage = (data) => {

    }

    onIceCandidate = iceCandidate => {
        console.log('on ice', iceCandidate);
        if (!!iceCandidate) {
            this.candidates.push(iceCandidate);
        }
    }

    onGatheringStateChange = state => {

    }

    startStream = async () => {


        const host = await AsyncStorage.getItem('WSS');
        // const host = 'http://192.168.0.2:8082'

        console.log('123candidates', this.candidates, host);
        let streamId;
        try {
            const response = await fetch(`${host}/streams`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            const streamResponse = await response.json();
            streamId = streamResponse.result.id;
            console.log('123candidates2');
        } catch (e) {
            console.log('123candidatesE', e);

        }


        console.log('123candidates3');


        const peerResponse = await fetch(`${host}/peers`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                isPublisher: true,
                offer: this.offer
            })
        })
        const peerJson = await peerResponse.json();
        const peerId = peerJson.result.id;
        await fetch(`${host}/peers/${peerId}/candidates`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                candidates: this.candidates
            })
        })
        const answerResponse = await fetch(`${host}/peers/${peerId}/answer`)
        const answerJson = await answerResponse.json();
        const answer = answerJson.result.answer;
        this.pc.setRemoteDescription(answer);


        const candidatesReponse = await fetch(`${host}/peers/${peerId}/candidates`)
        const candidatesJson = await candidatesReponse.json();

        const candidates = candidatesJson.result.candidates;
        candidates.forEach (candidate => this.pc.addIceCandidate(candidate))
        await fetch(`${host}/streams/${streamId}/participiants`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                peerId: peerId
            })
        })
        return streamId;
    }
}

export const engineInst = new StreamEngine();
