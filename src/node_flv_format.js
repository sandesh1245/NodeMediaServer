const EventEmitter = require('events');
const AMF = require('./node_core_amf');
const AV = require('./node_core_av');
const { AUDIO_SOUND_RATE, AUDIO_SOUND_SIZE, AUDIO_CODEC_NAME, VIDEO_CODEC_NAME } = require('./node_core_av');

class NodeFlvMuxer {
  static createFlvHeader(haveAudio, haveVideo) {
    let FLVHeader = Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]);
    if (haveAudio) {
      FLVHeader[4] |= 0b00000100;
    }

    if (haveVideo) {
      FLVHeader[4] |= 0b00000001;
    }
    return FLVHeader;
  }

  static createFlvTag(type, time, data) {
    let FLVTagHeader = Buffer.alloc(11);
    FLVTagHeader[0] = type;
    FLVTagHeader.writeUIntBE(data.length, 1, 3);
    FLVTagHeader[4] = (time >> 16) & 0xff;
    FLVTagHeader[5] = (time >> 8) & 0xff;
    FLVTagHeader[6] = time & 0xff;
    FLVTagHeader[7] = (time >> 24) & 0xff;
    FLVTagHeader.writeUIntBE(0, 8, 3);
    let PreviousTagSize = Buffer.alloc(4);
    PreviousTagSize.writeUInt32BE(11 + data.length);
    return Buffer.concat([FLVTagHeader, data, PreviousTagSize]);
  }
}

class NodeFlvDemuxer extends EventEmitter {
  constructor() {
    super();
    this.audioCodec = 0;
    this.videoCodec = 0;
    this.isFirstAudioReceived = false;
    this.isFirstVideoReceived = false;
  }

  parseFlvTag(tagType, tagTime, tagBody) {
    switch (tagType) {
    case 8:
      this.handleAudioData(tagTime, tagBody);
      break;
    case 9:
      this.handleVideoData(tagTime, tagBody);
      break;
    case 18:
      this.handleScriptData(tagTime, tagBody);
      break;
    }
  }

  handleAudioData(time, data) {
    let sound_format = (data[0] >> 4) & 0x0f;
    let sound_type = data[0] & 0x01;
    let sound_size = (data[0] >> 1) & 0x01;
    let sound_rate = (data[0] >> 2) & 0x03;
    let flags = 1;
    if (this.audioCodec == 0) {
      this.audioCodec = sound_format;
      this.audioCodecName = AUDIO_CODEC_NAME[sound_format];
      this.audioSamplerate = AUDIO_SOUND_RATE[sound_rate];
      this.audioSamplesize = AUDIO_SOUND_SIZE[sound_size];
      this.audioChannels = ++sound_type;

      if (sound_format == 4) {
        this.audioSamplerate = 16000;
      } else if (sound_format == 5) {
        this.audioSamplerate = 8000;
      } else if (sound_format == 11) {
        this.audioSamplerate = 16000;
      } else if (sound_format == 14) {
        this.audioSamplerate = 8000;
      }
    }

    if (sound_format == 10 && data[1] == 0) {
      //cache aac sequence header
      this.isFirstAudioReceived = true;
      this.aacSequenceHeader = Buffer.alloc(data.length);
      data.copy(this.aacSequenceHeader);
      let info = AV.readAACSpecificConfig(this.aacSequenceHeader);
      this.audioProfileName = AV.getAACProfileName(info);
      this.audioSamplerate = info.sample_rate;
      this.audioChannels = info.channels;
      flags = 0;
    } else if (!this.isFirstAudioReceived) {
      this.isFirstAudioReceived = true;
      flags = 0;
    }

    this.emit('audio', sound_format, time, time, flags, data);
  }

  handleVideoData(time, data) {
    let frame_type = (data[0] >> 4) & 0x0f;
    let codec_id = data[0] & 0x0f;
    let flags = 2;
    let dts = time;
    if (codec_id === 7 || codec_id === 12) {
      //cache avc sequence header
      if (frame_type === 1 && data[1] === 0) {
        this.avcSequenceHeader = Buffer.alloc(data.length);
        data.copy(this.avcSequenceHeader);
        let info = AV.readAVCSpecificConfig(this.avcSequenceHeader);
        this.videoWidth = info.width;
        this.videoHeight = info.height;
        this.videoProfileName = AV.getAVCProfileName(info);
        this.videoLevel = info.level;
        flags = 0;
      } else if (frame_type == 1 && data[1] == 1) {
        flags = 1;
      }

      if (data[1] === 1) {
        dts += data.readIntBE(2, 3);
      }
    }

    if (this.videoCodec == 0) {
      this.videoCodec = codec_id;
      this.videoCodecName = VIDEO_CODEC_NAME[codec_id];
    }

    this.emit('video', codec_id, time, dts, flags, data);
  }

  handleScriptData(time, data) {
    let amf0data = AMF.decodeAmf0Data(data);
    if (amf0data && amf0data.cmd === 'onMetaData') {
      this.medaData = data;
      this.medaDataObj = amf0data.dataObj;
      this.audioCodec = this.medaDataObj.audiocodecid || 0;
      this.audioCodecName = AUDIO_CODEC_NAME[this.audioCodec];
      this.audioChannels = this.medaDataObj.stereo ? 2 : 1;
      this.audioDataRate = this.medaDataObj.audiodatarate || 0;
      this.audioSamplerate = this.medaDataObj.audiosamplerate || 0;
      this.audioSamplesize = this.medaDataObj.audiosamplesize || 0;
      this.videoCodec = this.medaDataObj.videocodecid || 0;
      this.videoCodecName = VIDEO_CODEC_NAME[this.videoCodec];
      this.videoWidth = this.medaDataObj.width || 0;
      this.videoHeight = this.medaDataObj.height || 0;
      this.videoDataRate = this.medaDataObj.videodatarate || 0;
      this.videoFrameRate = this.medaDataObj.framerate || 0;
    }
    this.emit('script', time, data);
  }
}

module.exports = {
  NodeFlvMuxer,
  NodeFlvDemuxer
};
