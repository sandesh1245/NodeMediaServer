/**
 * @author [Mingliang Chen]
 * @email [illuspas@gmail.com]
 * @create date 2019-01-20 08:05:44
 * @modify date 2019-01-20 08:05:44
 * @desc [description]
 */

const RTMP_CHUNK_SIZE = 4000;

const RTMP_CHANNEL_AUDIO = 4;
const RTMP_CHANNEL_VIDEO = 5;
const RTMP_CHANNEL_DATA = 6;

const RTMP_TYPE_AUDIO = 8;
const RTMP_TYPE_VIDEO = 9;
const RTMP_TYPE_DATA = 18; // AMF0

const FLV = require('./node_flv_format');
const Logger = require('./node_core_logger');
const { genSessionID } = require('./node_core_utils');

class NodeBaseSession {
  constructor(stream) {
    this.stream = stream;
    this.id = genSessionID();
    this._resolve = () => {};
    this._reject = () => {};
  }

  readStream(size) {
    if (size > 0) {
      return new Promise((resolve, reject) => {
        this._reject = reject;
        const onReadable = () => {
          let chunk = this.stream.read(size);
          if (chunk != null) {
            this.stream.removeListener('readable', onReadable);
            resolve(chunk);
          }
        };
        this.stream.on('readable', onReadable);
        onReadable();
      });
    }
  }

  stopStream() {
    this._reject('stopStream');
  }

  waitIdle() {
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  stopIdle() {
    this._resolve('stopIdle');
  }

  clearGopCache() {
    if (this.flvGopCacheQueue) {
      this.flvGopCacheQueue.clear();
      this.flvGopCacheQueue = undefined;
    }

    if (this.rtmpGopCacheQueue) {
      this.rtmpGopCacheQueue.clear();
      this.rtmpGopCacheQueue = undefined;
    }
  }

  onAudioData(code, pts, dts, flags, data) {
    if (flags === 0) {
      Logger.debug(
        `Info Publisher Audio samplerate=${this.flvDemuxer.audioSamplerate} channels=${this.flvDemuxer.audioChannels} code=${this.flvDemuxer.audioCodecName} profile=${
          this.flvDemuxer.audioProfileName
        }`
      );
    }

    //create flv tag
    let flvTag = FLV.NodeFlvMuxer.createFlvTag(8, pts, data);

    //create rtmp tag
    let rtmpMessage = FLV.NodeRtmpMuxer.createRtmpMessage();
    rtmpMessage.chunkId = RTMP_CHANNEL_AUDIO;
    rtmpMessage.length = data.length;
    rtmpMessage.body = data;
    rtmpMessage.type = RTMP_TYPE_AUDIO;
    rtmpMessage.timestamp = pts;
    rtmpMessage.streamId = 1;
    let chunkSize = this.cfg.rtmp.chunk_size || RTMP_CHUNK_SIZE;
    let chunkMessage = FLV.NodeRtmpMuxer.createChunkMessage(rtmpMessage, chunkSize);

    //cache flv gop
    if (this.flvGopCacheQueue) {
      this.flvGopCacheQueue.add(flvTag);
    }

    //cache rtmp gop
    if (this.rtmpGopCacheQueue) {
      this.rtmpGopCacheQueue.add(chunkMessage);
    }

    for (let playerId of this.players) {
      let player = this.ses.get(playerId);

      if (player.numPlayCache === 0) {
        player.res.cork();
      } 

      if (player.constructor.name === 'NodeFlvSession') {
        player.res.write(flvTag);
      } else if (player.constructor.name === 'NodeRtmpSession') {
        player.res.write(chunkMessage);
      }
      player.numPlayCache++;

      if (player.numPlayCache === 10) {
        process.nextTick(() => player.res.uncork());
        player.numPlayCache = 0;
      }
    }
  }

  onVideoData(code, pts, dts, flags, data) {
    if (flags === 0) {
      Logger.debug(
        `Info Publisher Video size=${this.flvDemuxer.videoWidth}x${this.flvDemuxer.videoHeight} code=${this.flvDemuxer.videoCodecName} profile=${this.flvDemuxer.videoProfileName}`
      );
    }
    //create flv tag
    let flvTag = FLV.NodeFlvMuxer.createFlvTag(9, pts, data);

    //create rtmp tag
    let rtmpMessage = FLV.NodeRtmpMuxer.createRtmpMessage();
    rtmpMessage.chunkId = RTMP_CHANNEL_VIDEO;
    rtmpMessage.length = data.length;
    rtmpMessage.body = data;
    rtmpMessage.type = RTMP_TYPE_VIDEO;
    rtmpMessage.timestamp = pts;
    rtmpMessage.streamId = 1;
    let chunkSize = this.cfg.rtmp.chunk_size || RTMP_CHUNK_SIZE;
    let chunkMessage = FLV.NodeRtmpMuxer.createChunkMessage(rtmpMessage, chunkSize);

    //ONLY video is H.264/H.265 enable gop cache
    if (code === 7 || code === 12) {
      if (flags === 0) {
        this.flvGopCacheQueue = this.cfg.gop_cache ? new Set() : null;
        this.rtmpGopCacheQueue = this.cfg.gop_cache ? new Set() : null;
      } else if (flags === 1 && this.flvGopCacheQueue && this.rtmpGopCacheQueue) {
        this.flvGopCacheQueue.clear();
        this.rtmpGopCacheQueue.clear();
      }

      if (flags > 0 && this.flvGopCacheQueue && this.rtmpGopCacheQueue) {
        this.flvGopCacheQueue.add(flvTag);
        this.rtmpGopCacheQueue.add(chunkMessage);
      }
    }

    for (let playerId of this.players) {
      let player = this.ses.get(playerId);
      
      if (player.numPlayCache === 0) {
        player.res.cork();
      }

      if (player.constructor.name === 'NodeFlvSession') {
        player.res.write(flvTag);
      } else if (player.constructor.name === 'NodeRtmpSession') {
        player.res.write(chunkMessage);
      }
      player.numPlayCache++;

      if (player.numPlayCache === 10) {
        process.nextTick(() => player.res.uncork());
        player.numPlayCache = 0;
      }
    }
  }

  onScriptData(time, data) {
    //create flv tag
    let flvTag = FLV.NodeFlvMuxer.createFlvTag(18, 0, data);
    //create rtmp tag
    let rtmpMessage = FLV.NodeRtmpMuxer.createRtmpMessage();
    rtmpMessage.chunkId = RTMP_CHANNEL_DATA;
    rtmpMessage.length = data.length;
    rtmpMessage.body = data;
    rtmpMessage.type = RTMP_TYPE_DATA;
    rtmpMessage.timestamp = time;
    rtmpMessage.streamId = 1;
    let chunkSize = this.cfg.rtmp.chunk_size || RTMP_CHUNK_SIZE;
    let chunkMessage = FLV.NodeRtmpMuxer.createChunkMessage(rtmpMessage, chunkSize);

    for (let playerId of this.players) {
      let player = this.ses.get(playerId);
      if (player.constructor.name === 'NodeFlvSession') {
        player.res.write(flvTag);
      } else if (player.constructor.name === 'NodeRtmpSession') {
        player.res.write(chunkMessage);
      }
    }

  }
}

module.exports = NodeBaseSession;
