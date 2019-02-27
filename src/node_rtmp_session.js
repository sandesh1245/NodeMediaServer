const QueryString = require('querystring');

const NodeBaseSession = require('./node_base_session');
const RtmpHandshake = require('./node_rtmp_handshake');
const Logger = require('./node_core_logger');
const AMF = require('./node_core_amf');
const FLV = require('./node_flv_format');

const RTMP_CHUNK_HEADER_SIZE = [11, 7, 3, 0];

const RTMP_CHANNEL_PROTOCOL = 2;
const RTMP_CHANNEL_INVOKE = 3;
const RTMP_CHANNEL_AUDIO = 4;
const RTMP_CHANNEL_VIDEO = 5;
const RTMP_CHANNEL_DATA = 6;

/* Protocol Control Messages */
const RTMP_TYPE_SET_CHUNK_SIZE = 1;
const RTMP_TYPE_ABORT = 2;
const RTMP_TYPE_ACKNOWLEDGEMENT = 3; // bytes read report
const RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE = 5; // server bandwidth
const RTMP_TYPE_SET_PEER_BANDWIDTH = 6; // client bandwidth

/* User Control Messages Event (4) */
const RTMP_TYPE_EVENT = 4;

const RTMP_TYPE_AUDIO = 8;
const RTMP_TYPE_VIDEO = 9;

/* Data Message */
const RTMP_TYPE_FLEX_STREAM = 15; // AMF3
const RTMP_TYPE_DATA = 18; // AMF0

/* Shared Object Message */
const RTMP_TYPE_FLEX_OBJECT = 16; // AMF3
const RTMP_TYPE_SHARED_OBJECT = 19; // AMF0

/* Command Message */
const RTMP_TYPE_FLEX_MESSAGE = 17; // AMF3
const RTMP_TYPE_INVOKE = 20; // AMF0

/* Aggregate Message */
const RTMP_TYPE_METADATA = 22;

const RTMP_CHUNK_SIZE = 4000;

class NodeRtmpSession extends NodeBaseSession {
  constructor(ctx, socket) {
    super(socket);
    this.ip = socket.remoteAddress;
    this.evt = ctx.evt;
    this.cfg = ctx.cfg;
    this.ses = ctx.ses;
    this.pbs = ctx.pbs;
    this.idl = ctx.idl;
    this.socket = socket;
    this.tag = 'rtmp';
    this.streamApp = '';
    this.streamName = '';
    this.streamPath = '';
    this.streamId = 0;
    this.isReject = false;
    this.isStart = false;
    this.isLocal = this.ip === '127.0.0.1';
    this.isIdle = false;
    this.isPlay = false;
    this.isPublish = false;
    this.inMessages = new Map();
    this.inChunkSize = 128;
    this.outChunkSize = this.cfg.rtmp.chunk_size || RTMP_CHUNK_SIZE;
    this.numPlayCache = 0;
    this.receiveAudio = true;
    this.receiveVideo = true;
    this.hasAudio = true;
    this.hasVideo = true;
    this.gopCacheQueue = null;
    this.ses.set(this.id, this);
  }

  run() {
    this.isStart = true;
    this.socket.on('end', this.stop.bind(this));
    this.socket.on('close', this.stop.bind(this));
    this.socket.on('error', this.stop.bind(this));
    this.socket.on('timeout', this.stop.bind(this));
    this.socket.setTimeout(30000);
    this.handleData();
  }

  stop() {
    if (this.isStart) {
      this.isStart = false;
      this.socket.destroy();
      this.stopStream();

      if (this.isPublish) {
        this.pbs.delete(this.streamPath);
      }

      this.ses.delete(this.id);
    }
  }

  async handleData() {
    try {
      let c0 = await this.readStream(1);
      if (c0[0] != 0x03) {
        throw { message: 'Not a rtmp stream' };
      }
      let c1 = await this.readStream(1536);
      let s0s1s2 = RtmpHandshake.generateS0S1S2(c1);
      this.socket.write(s0s1s2);

      await this.readStream(1536); //c2

      while (this.isStart) {
        let chunkBasicHeader = await this.readStream(1);
        let fmt = chunkBasicHeader[0] >> 6;
        let cid = chunkBasicHeader[0] & 0x3f;
        if (cid === 0) {
          let extBuf = await this.readStream(1);
          cid = 64 + extBuf[0];
        } else if (cid === 1) {
          let extBuf = await this.readStream(2);
          cid = 64 + extBuf[0] + (extBuf[1] << 8);
        }

        let chunkMessageSize = RTMP_CHUNK_HEADER_SIZE[fmt];
        let chunkMessage = await this.readStream(chunkMessageSize);
        let rtmpMessage;
        let precedingRtmpMessage = this.inMessages.get(cid);
        if (precedingRtmpMessage) {
          rtmpMessage = precedingRtmpMessage;
        } else {
          rtmpMessage = FLV.NodeRtmpMuxer.createRtmpMessage();
        }

        if (chunkMessageSize >= 3) {
          rtmpMessage.timestampDelta = chunkMessage.readUIntBE(0, 3);
          if (chunkMessageSize >= 7) {
            rtmpMessage.length = chunkMessage.readUIntBE(3, 3);
            rtmpMessage.type = chunkMessage[6];
            if (chunkMessageSize === 11) {
              rtmpMessage.streamId = chunkMessage.readUInt32LE(7);
            }
          }
        }

        if (rtmpMessage.timestampDelta === 0x00ffffff) {
          let extTimeBuf = await this.readStream(4);
          rtmpMessage.timestampDelta = extTimeBuf.readUInt32BE();
        }

        //realloc payload
        if (rtmpMessage.capabilities < rtmpMessage.length) {
          let oldBuffer = rtmpMessage.payloadBuffer;
          rtmpMessage.capabilities = rtmpMessage.length * 2;
          rtmpMessage.payloadBuffer = Buffer.alloc(rtmpMessage.capabilities);
          if (rtmpMessage.readBytes > 0) {
            oldBuffer.copy(rtmpMessage.payloadBuffer, 0, 0, rtmpMessage.readBytes);
          }
        }

        //read chunk
        let nChunkSize = Math.min(this.inChunkSize, rtmpMessage.length - rtmpMessage.readBytes);
        let chunk = await this.readStream(nChunkSize);
        chunk.copy(rtmpMessage.payloadBuffer, rtmpMessage.readBytes);
        rtmpMessage.readBytes += nChunkSize;
        if (rtmpMessage.readBytes === rtmpMessage.length) {
          if (fmt === 0) {
            rtmpMessage.timestamp = rtmpMessage.timestampDelta;
          } else {
            rtmpMessage.timestamp += rtmpMessage.timestampDelta;
          }
          rtmpMessage.body = rtmpMessage.payloadBuffer.slice(0, rtmpMessage.length);
          this.handleRtmpMessage(rtmpMessage);
          rtmpMessage.readBytes = 0;
          rtmpMessage.body = null;
        }

        this.inMessages.set(cid, rtmpMessage);
      }
    } catch (e) {
      Logger.error(e);
    }
    this.stop();
  }

  handleRtmpMessage(rtmpMessage) {
    // Logger.log('handleRtmpMessage ',rtmpMessage.type);
    switch (rtmpMessage.type) {
    case RTMP_TYPE_SET_CHUNK_SIZE:
    case RTMP_TYPE_ABORT:
    case RTMP_TYPE_ACKNOWLEDGEMENT:
    case RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE:
    case RTMP_TYPE_SET_PEER_BANDWIDTH:
      this.rtmpControlHandler(rtmpMessage);
      break;
    case RTMP_TYPE_EVENT:
      this.rtmpEventHandler(rtmpMessage);
      break;
    case RTMP_TYPE_AUDIO:
      this.rtmpAudioHandler(rtmpMessage);
      break;
    case RTMP_TYPE_VIDEO:
      this.rtmpVideoHandler(rtmpMessage);
      break;
    case RTMP_TYPE_FLEX_MESSAGE:
    case RTMP_TYPE_INVOKE:
      this.rtmpInvokeHandler(rtmpMessage);
      break;
    case RTMP_TYPE_FLEX_STREAM:
    case RTMP_TYPE_DATA:
      this.rtmpDataHandler(rtmpMessage);
      break;
    }
  }

  rtmpControlHandler(rtmpMessage) {
    switch (rtmpMessage.type) {
    case RTMP_TYPE_SET_CHUNK_SIZE:
      this.inChunkSize = rtmpMessage.body.readUInt32BE();
      // Logger.debug('set inChunkSize', this.inChunkSize);
      break;
    case RTMP_TYPE_ABORT:
      break;
    case RTMP_TYPE_ACKNOWLEDGEMENT:
      break;
    case RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE:
      this.ackSize = rtmpMessage.body.readUInt32BE();
      // Logger.debug('set ack Size', this.ackSize);
      break;
    case RTMP_TYPE_SET_PEER_BANDWIDTH:
      break;
    }
  }

  rtmpEventHandler() {}

  rtmpInvokeHandler(rtmpMessage) {
    let offset = rtmpMessage.type === RTMP_TYPE_FLEX_MESSAGE ? 1 : 0;
    let payload = rtmpMessage.body.slice(offset, rtmpMessage.length);
    let invokeMessage = AMF.decodeAmf0Cmd(payload);
    // Logger.log(invokeMessage);
    switch (invokeMessage.cmd) {
    case 'connect':
      this.onConnect(invokeMessage);
      break;
    case 'releaseStream':
      break;
    case 'FCPublish':
      break;
    case 'createStream':
      this.onCreateStream(invokeMessage);
      break;
    case 'publish':
      invokeMessage.streamId = rtmpMessage.streamId;
      this.onPublish(invokeMessage);
      break;
    case 'play':
      invokeMessage.streamId = rtmpMessage.streamId;
      this.onPlay(invokeMessage);
      break;
    case 'pause':
      this.onPause(invokeMessage);
      break;
    case 'FCUnpublish':
      break;
    case 'deleteStream':
      this.onDeleteStream(invokeMessage);
      break;
    case 'closeStream':
      invokeMessage.streamId = rtmpMessage.streamId;
      this.onDeleteStream(invokeMessage);
      break;
    case 'receiveAudio':
      this.onReceiveAudio(invokeMessage);
      break;
    case 'receiveVideo':
      this.onReceiveVideo(invokeMessage);
      break;
    }
  }

  rtmpVideoHandler(rtmpMessage) {
    this.flvDemuxer.parseFlvTag(rtmpMessage.type, rtmpMessage.timestamp, rtmpMessage.body);
  }

  rtmpAudioHandler(rtmpMessage) {
    this.flvDemuxer.parseFlvTag(rtmpMessage.type, rtmpMessage.timestamp, rtmpMessage.body);
  }

  rtmpDataHandler(rtmpMessage) {
    this.flvDemuxer.parseFlvTag(rtmpMessage.type, rtmpMessage.timestamp, rtmpMessage.body);
  }

  onAudioData(code, pts, dts, flags, data) {
    // Logger.debug('rtmp onAudioData', pts, dts, flags);
  }

  onVideoData(code, pts, dts, flags, data) {
    // Logger.debug('rtmp onVideoData', pts, dts, flags);
  }

  onScriptData(time, data) {
  }

  onConnect(invokeMessage) {
    Logger.debug('onConnect', invokeMessage);
    invokeMessage.cmdObj.app = invokeMessage.cmdObj.app.split('/')[0];
    this.connectCmdObj = invokeMessage.cmdObj;
    this.streamApp = invokeMessage.cmdObj.app;
    this.objectEncoding = invokeMessage.cmdObj.objectEncoding || 0;
    this.sendWindowACK(5000000);
    this.sendSetPeerBandwidth(5000000, 2);
    this.sendSetChunkSize(this.outChunkSize);
    this.respondConnect(invokeMessage.transId);
  }

  onCreateStream(invokeMessage) {
    Logger.debug('onCreateStream', invokeMessage);
    if (this.streamId > 0) {
      //v2.0.0, Simplified logic, one NetConnect supports only one NetStream
      return;
    }
    this.respondCreateStream(invokeMessage.transId);
  }

  onDeleteStream(invokeMessage) {
    if (this.streamId > 0) {
      if (this.isPublish) {
        this.isPublish = false;
        this.sendStatusMessage(this.streamId, 'status', 'NetStream.Unpublish.Success', 'Stop publishing');
      } else if (this.isPlay) {
        this.isPlay = false;
        this.sendStatusMessage(this.streamId, 'status', 'NetStream.Play.Stop', 'Stop live');
      }
      this.streamId = 0;
    }
    Logger.debug('onDeleteStream', invokeMessage);
  }

  onPublish(invokeMessage) {
    Logger.debug('onPublish', invokeMessage);
    if (typeof invokeMessage.streamName !== 'string') {
      throw { message: 'The stream name requested for publish does not comply.' };
    }

    if (invokeMessage.streamId != this.streamId) {
      throw `The stream id for the request publish does not match the id created.${invokeMessage.streamId},${this.streamId}`;
    }

    this.streamName = invokeMessage.streamName.split('?')[0];
    this.streamPath = '/' + this.streamApp + '/' + invokeMessage.streamName.split('?')[0];
    this.streamQuery = QueryString.parse(invokeMessage.streamName.split('?')[1]);
    Logger.log(`New Publisher id=${this.id} ip=${this.ip} stream_path=${this.streamPath} query=${JSON.stringify(this.streamQuery)} via=${this.tag}`);

    if (this.pbs.has(this.streamPath)) {
      throw `Already has a stream publish to ${this.streamPath}`;
    }
    this.pbs.set(this.streamPath, this.id);
    this.isPublish = true;
    this.flvDemuxer = new FLV.NodeFlvDemuxer();
    this.flvDemuxer.on('audio', this.onAudioData.bind(this));
    this.flvDemuxer.on('video', this.onVideoData.bind(this));
    this.flvDemuxer.on('script', this.onScriptData.bind(this));
    this.sendStatusMessage(this.streamId, 'status', 'NetStream.Publish.Start', `${this.publishStreamPath} is now published.`);
  }

  onPlay(invokeMessage) {
    Logger.debug('onPlay', invokeMessage);
    this.isPlay = true;
    this.sendStatusMessage(this.streamId, 'status', 'NetStream.Play.Start', 'Star live');
  }

  onPause(invokeMessage) {
    Logger.debug('onPause', invokeMessage);
  }

  onReceiveAudio(invokeMessage) {
    Logger.debug('onReceiveAudio', invokeMessage);
  }

  onReceiveVideo(invokeMessage) {
    Logger.debug('onReceiveVideo', invokeMessage);
  }

  sendACK(size) {
    let rtmpBuffer = Buffer.from('02000000000004030000000000000000', 'hex');
    rtmpBuffer.writeUInt32BE(size, 12);
    this.socket.write(rtmpBuffer);
  }

  sendWindowACK(size) {
    let rtmpBuffer = Buffer.from('02000000000004050000000000000000', 'hex');
    rtmpBuffer.writeUInt32BE(size, 12);
    this.socket.write(rtmpBuffer);
  }

  sendSetPeerBandwidth(size, type) {
    let rtmpBuffer = Buffer.from('0200000000000506000000000000000000', 'hex');
    rtmpBuffer.writeUInt32BE(size, 12);
    rtmpBuffer[16] = type;
    this.socket.write(rtmpBuffer);
  }

  sendSetChunkSize(size) {
    let rtmpBuffer = Buffer.from('02000000000004010000000000000000', 'hex');
    rtmpBuffer.writeUInt32BE(size, 12);
    this.socket.write(rtmpBuffer);
  }

  sendStatusMessage(sid, level, code, description) {
    let opt = {
      cmd: 'onStatus',
      transId: 0,
      cmdObj: null,
      info: {
        level: level,
        code: code,
        description: description
      }
    };
    this.sendInvokeMessage(sid, opt);
  }

  sendInvokeMessage(sid, opt) {
    let rtmpMessage = FLV.NodeRtmpMuxer.createRtmpMessage();
    rtmpMessage.chunkId = RTMP_CHANNEL_INVOKE;
    rtmpMessage.type = RTMP_TYPE_INVOKE;
    rtmpMessage.streamId = sid;
    rtmpMessage.body = AMF.encodeAmf0Cmd(opt);
    rtmpMessage.length = rtmpMessage.body.length;
    let chunks = FLV.NodeRtmpMuxer.createChunkMessage(rtmpMessage, this.outChunkSize);
    this.socket.write(chunks);
  }

  respondConnect(tid) {
    let opt = {
      cmd: '_result',
      transId: tid,
      cmdObj: {
        fmsVer: 'FMS/3,0,1,123',
        capabilities: 31
      },
      info: {
        level: 'status',
        code: 'NetConnection.Connect.Success',
        description: 'Connection succeeded.',
        objectEncoding: this.objectEncoding
      }
    };
    this.sendInvokeMessage(0, opt);
  }

  respondCreateStream(tid) {
    this.streamId++;
    let opt = {
      cmd: '_result',
      transId: tid,
      cmdObj: null,
      info: this.streamId
    };
    this.sendInvokeMessage(0, opt);
  }
}

module.exports = NodeRtmpSession;
