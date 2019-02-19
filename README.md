# Node-Media-Server-v2
Next Generation of Node-Media-Server

## 特性
 * 支持http-flv 推流
 * 支持http-flv, websocket-flv 播放
 * 支持Gop Cache
 * 支持H.265 over FLV (id=12)

## 计划(挖坑)
 * 基于N-API实现内部音频转码器(speex,nellymoser,g.711 ==> AAC/OPUS，AAC <==> OPUS)
 * 或者牺牲一定性能用WASM实现转码器换来跨平台能力 ？？
 * 支持WebRtc、RTSP、RTMP推流与播放
 * 支持集群模式
 * 支持录制
 * PM2统计插件
 * Web管理后台
 * 支持GB28181、JT/T1078媒体格式接入
 
## 推流方式

```base
ffmpeg -re -i STREAM.mp4 -c copy -f flv http://192.168.0.10:8000/live/stream.flv
```

## 播放方法

```base
ffplay http://192.168.0.10:8000/live/stream.flv
```
