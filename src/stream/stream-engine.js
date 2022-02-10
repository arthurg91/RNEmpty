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

const selectBestRegion = async (regions, realm) => {
    return new Promise(async (resolve, reject) => {
        if (!regions) {
            reject('No regions available');
        }

        const result = [];

        for (const region of regions) {
            const statTime = Date.now();

            try {
                const response = await fetch(`https://${region.domain}.${realm}`);
                const endTime = Date.now();

                result.push({
                    ping: endTime - statTime,
                    region: region,
                })
            } catch (e) {
                // console.log('REGION-PING-ERROR', `https://${region.domain}.${realm}`);

                const endTime = Date.now();

                result.push({
                    ping: endTime - statTime,
                    region: region,
                })
            }
        }

        result.sort((left, right) => Number(left.ping > right.ping));

        const selectedRegion = result[0] && result[0].region && result[0].region.region;

        resolve(selectedRegion);
    })
};

const REQUESTS = {
    signIn: 'users.signIn',
    getIceServers: 'streaming.getIceServers',
    createStream: 'streaming.create',
    getStreamRegions: 'streaming.getRegions',
    createStreamChannel: 'streaming.createChannel',
    joinStreamChannel: 'streaming.joinChannel',
    subscribeStream: 'streaming.subscribe',
    streamingCandidates: 'streaming.candidates',
};

export default class StreamEngine {
    candidates = [];
    streamUrl;
    pc;
    onUrl;
    offer;

    WS = null;
    completions = {};
    channel = null;

    constructor() {
        this.WS = new WebSocket('wss://srt.tubit.com');
        this.WS.onopen = this._wsOnOpen;
        this.WS.onmessage = this._wsOnMessage;
        this.WS.onerror = this._wsOnError;
        this.WS.onclose = this._wsOnClose;
    }

    _wsOnOpen = (e) => {
        // console.log('WS-OPEN', e);
        this._startAuth();
    };

    _wsOnMessage = (e) => {
        const message = JSON.parse(e.data);

        console.log('TEST-', message);
        // event from backend
        if (message && message.method === 'event' && message.params && message.params.event) {
            if (message.params.event === 'event.streaming.finished') {
                const { streamId } = message.params

                console.log('FINISHED', streamId, this.streamID === streamId);
            }

            if (message.params.event === 'event.streaming.paused') {
                const { streamId } = message.params

                console.log('PAUSED', streamId, this.streamID === streamId);
            }

            if (message.params.event === 'event.streaming.channel.joined') {
                const { jsep } = message.params;

                console.log('JOINED', jsep);

                this.pc.setRemoteDescription(jsep);
            }

            //event.streaming.channel.joined"
            // streaming candidates
        }

        // response on send
        if (message && message.id) {
            if (message.error) {
                this.completions[message.id] = {
                    ...this.completions[message.id],
                    status: 'error',
                };

                console.log(`ERROR-${this.completions[message.id]}`, message.error);
            }

            if (message.result) {
                if (message.result) {
                    this.completions[message.id] = {
                        ...this.completions[message.id],
                        status: 'complete',
                        result: message.result,
                    };
                }
            }

            // get ice servers
            if (this.completions[REQUESTS.signIn]?.status === 'complete' && this.completions[REQUESTS.getIceServers]?.status !== 'complete') {
                this._getIceServers();
            }

            // init peer connection
            if (this.completions[REQUESTS.getIceServers]?.status === 'complete' && this.completions[REQUESTS.getIceServers]?.result && !this.pc) {
                this._initPeerConnection();
            }

            // get regions
            if (this.completions[REQUESTS.getStreamRegions]?.status === 'complete' && this.completions[REQUESTS.getStreamRegions]?.result && this.pc && !this.regionInicialized) {

                const regions = this.completions[REQUESTS.getStreamRegions].result;

                let availableRegions = (regions || {}).root.filter(
                    region => [].indexOf(region) === -1,
                );

                if (availableRegions.length === 0) {
                    availableRegions = (regions || {}).left;
                }

                selectBestRegion(availableRegions, 'tubit.com').then((bestRegion) => {
                    this.regionInicialized = true;

                    this._createStreamChannel(bestRegion)
                }).catch((e) => {
                    // console.log('SELECT-BEST-REGION-ERROR', e);
                });
            }

            // create stream channel
            if (this.completions[REQUESTS.createStreamChannel]?.status === 'complete' && this.completions[REQUESTS.createStreamChannel]?.result && !this.channelInicialized) {
                const { channel: { _id } } = this.completions[REQUESTS.createStreamChannel].result
                this.channelID = _id;
                this.channelInicialized = true;
                this._initMediaDevices();
            }

            // join chanel
            if (this.completions[REQUESTS.joinStreamChannel]?.status === 'complete' && this.completions[REQUESTS.joinStreamChannel]?.result) {

            }

            // create stream
            if (this.completions[REQUESTS.createStream]?.status === 'complete' && this.completions[REQUESTS.createStream]?.result && !this.streamInicialized) {
                const { _id } = this.completions[REQUESTS.createStream].result;
                this.streamInicialized = true;

                this._subscribeOnStream(_id);
            }

            if (this.completions[REQUESTS.subscribeStream]?.status === 'complete' && this.completions[REQUESTS.subscribeStream]?.result) {
                const { _id } = this.completions[REQUESTS.subscribeStream].result;

                this.streamID = _id;
            }
        }
    };

    _initPeerConnection = () => {
        console.log('PC-INIT');

        this.pc = new RTCPeerConnection({
            iceServers: this.completions[REQUESTS.getIceServers].result,
        });

        this.pc.onicecandidate = this._pcOnIceCandidate;
        this.pc.onicecandidateerror = this._pcOnIceCandidateError;
        this.pc.oniceconnectionstatechange = this._pcOnIceCandidateStateChange;
        this.pc.onaddstream = this._pcOnAddStream;

        this._getStreamRegions()
    };

    _wsOnError = (e) => {
        console.log('WS-ERROR', e);
    };

    _wsOnClose = (e) => {
        console.log('WS-CLOSE', e);
    };

    _startAuth = () => {
        console.log('WS-START-AUTH');

        this.completions[REQUESTS.signIn] = {
            status: 'start',
            result: null,
        };

        const data = JSON.stringify({
            id: REQUESTS.signIn,
            jsonrpc: '2.0',
            method: REQUESTS.signIn,
            params: {
                apiVersion: 3,
                jwt: 'THIS_IS_TOKEN',
                meta: {
                    fingerprint: 'font.test-app.com',
                },
                project: 'tubit',
            },
        });

        this.WS.send(data);
    };

    _getIceServers = () => {
        // console.log('WS-GET-ICE-SERVERS');

        this.completions[REQUESTS.getIceServers] = {
            status: 'start',
            result: null,
        };

        const data = {
            id: REQUESTS.getIceServers,
            jsonrpc: '2.0',
            method: REQUESTS.getIceServers,
            params: {},
        };

        this.WS.send(JSON.stringify(data));
    };

    _pcOnIceCandidate = candidate => {
        if (candidate) {
            // console.log('PC-ICE-CANDIDATE', candidate);
            this.candidates.push(candidate);
        }
    };

    _pcOnIceCandidateError = (e) => {
        // console.log('PC-ICE-CANDIDATE-ERROR', e);
    };

    _pcOnIceCandidateStateChange = (e) => {
        // console.log('PC-ICE-CHANGED', e);
    };

    _pcOnAddStream = (e) => {
        // console.log('PC-ADD-STREAM', e);
    };

    _initMediaDevices = async () => {
        // console.log('INIT-MEDIA-DEVICES');

        const sourceInfos = await mediaDevices.enumerateDevices();

        let videoSourceId;

        for (let i = 0; i < sourceInfos.length; i++) {
            const sourceInfo = sourceInfos[i];

            if (sourceInfo.kind === 'videoinput' && sourceInfo.facing === 'front') {
                videoSourceId = sourceInfo.deviceId;
            }
        }

        const stream = await mediaDevices.getUserMedia({
            audio: true,
            video: {
                minWidth: 640,
                minHeight: 360,
                minFrameRate: 30,
                facingMode: 'user',
                deviceId: videoSourceId,
            },
        })

        this.pc.addStream(stream);
        this.streamUrl = stream.toURL();
        this.onUrl && this.onUrl(this.streamUrl);

        let offer;

        try {
            offer = await this.pc.createOffer({ iceRestart: true })
            this.offer = offer;

            await this.pc.setLocalDescription(offer);
            this._joinStreamChannel(offer);
        } catch (e) {
            // console.log('PC-CREATE_OFFER', e);
        }
    };

    _createStream = () => {
        console.log('CREATE-STREAM');

        this.completions[REQUESTS.createStream] = {
            status: 'start',
            result: null,
        };

        const data = {
            id: REQUESTS.createStream,
            jsonrpc: '2.0',
            method: REQUESTS.createStream,
            params: {
                tags: [],
                channelId: this.channelID,
            },
        };

        this.WS.send(JSON.stringify(data));
    }

    _createStreamChannel = (region) => {
        console.log('CREATE-STREAM-CHANNEL');

        this.completions[REQUESTS.createStreamChannel] = {
            status: 'start',
            result: null,
        };

        const data = {
            id: REQUESTS.createStreamChannel,
            jsonrpc: '2.0',
            method: REQUESTS.createStreamChannel,
            params: {
                type: 'streamer',
                region
            },
        };

        this.WS.send(JSON.stringify(data));
    }

    _getStreamRegions = () => {
        // console.log('GET-STREAM-REGIONS');

        this.completions[REQUESTS.getStreamRegions] = {
            status: 'start',
            result: null,
        };

        const data = {
            id: REQUESTS.getStreamRegions,
            jsonrpc: '2.0',
            method: REQUESTS.getStreamRegions,
            params: {},
        };

        this.WS.send(JSON.stringify(data));
    }

    _joinStreamChannel = (offer) => {
        console.log('JOIN-STREAM-CHANNEL');

        this.completions[REQUESTS.joinStreamChannel] = {
            status: 'start',
            result: null,
        };

        const data = {
            id: REQUESTS.joinStreamChannel,
            jsonrpc: '2.0',
            method: REQUESTS.joinStreamChannel,
            params: {
                channelId: this.channelID,
                jsep: offer
            },
        };

        this.WS.send(JSON.stringify(data));
    }

    _subscribeOnStream = (streamID) => {
        console.log('SUBSCRIBE-STREAM');

        this.completions[REQUESTS.subscribeStream] = {
            status: 'start',
            result: null,
        };

        const data = {
            id: REQUESTS.subscribeStream,
            jsonrpc: '2.0',
            method: REQUESTS.subscribeStream,
            params: {
                streamId: streamID,
            },
        };

        this.WS.send(JSON.stringify(data));
    }

    startStream = async () => {
        this._createStream();

        return String(this.channelID);
    };
}

export const engineInst = new StreamEngine();
