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

export default class WatchEngine {
    candidates = [];
    streamUrl;
    pc;
    onUrl;
    offer;
    host;
    peerId;

    remoteDataChannel;

     constructor() {
        // this.host = await AsyncStorage.getItem('WSS');
        this.host = 'http://192.168.0.2:8082'

        this.pc = new RTCPeerConnection()
        this.pc.onicecandidate = this.onIceCandidate;
        this.pc.onicegatheringstatechange = this.onGatheringStateChange;
        this.pc.onaddstream = this.onAddStream;
        this.pc.onaddtrack = this.onAddTrack;
        this.pc.ondatachannel = this.onDataChannel;
        // this.pc.on('datachannel', this.onDataChannel);
        // this.pc.addListener('dataChannelReceiveMessage', this.onDataChannel2);
        this.init();

    }

    init = async  () => {
        const response = await fetch(`${this.host}/peers`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        const createPeerResponse = await response.json();
        const offer = createPeerResponse.result.offer;
        const peerId = createPeerResponse.result.id;
        this.peerId = peerId;
        await this.pc.setRemoteDescription(offer)

        const candidatesReponse = await fetch(`${this.host}/peers/${peerId}/candidates`)
        const candidatesJson = await candidatesReponse.json();

        const candidates = candidatesJson.result.candidates;
        candidates.forEach (candidate => this.pc.addIceCandidate(candidate))
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        await fetch(`${this.host}/peers/${peerId}/answer`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answer: answer })
        })

        console.log('watch init finished', this.peerId)
    }

    joinStream = async (streamId) => {
         console.log('123 join', streamId, this.candidates.length)
        await fetch(`${this.host}/peers/${this.peerId}/candidates`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                candidates: this.candidates
            })
        })

        await fetch(`${this.host}/streams/${streamId}/viewers`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                peerId: this.peerId
            })
        })

        console.log('on join finished')
    }

    onIceCandidate = iceCandidate => {
        // console.log('on ice', iceCandidate);
        if (!!iceCandidate) {
            this.candidates.push(iceCandidate);
        }
    }

    onAddStream = event => {
        console.log('on add stream', event.stream);
        const url = event.stream.toURL();
        this.onUrl && this.onUrl(url);
    }

    onAddTrack = track => {
        console.log('on add track', track);
    }

    onDataChannel = dataChannel => {

        console.log('on data channel', dataChannel.channel);
        this.remoteDataChannel = dataChannel.channel;
        // this.pc.on('message', this.onMessage);

        this.remoteDataChannel.onmessage = this.onMessage;
    }

    onDataChannel2 = dataChannel => {
        console.log('on data channel2', dataChannel);
        this.remoteDataChannel = dataChannel;
        this.remoteDataChannel.addListener('message', this.onMessage())
    }

    onMessage = async message => {
        console.log('on data channel message', message)
        const json = JSON.parse(message.data);
        console.log('parsed msg', json);
        if (json.cmd === 'OnNegotiationNeeded') {
            const offer = json.offer;
            await this.pc.setRemoteDescription(offer)
            const answer = await this.pc.createAnswer()
            await this.pc.setLocalDescription(answer);

            await fetch(`${this.host}/peers/${this.peerId}/answer`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ answer: answer })
            })
        }
    }

    onGatheringStateChange = state => {

    }
}

export const engineInst = new WatchEngine();
