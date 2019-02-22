# Node-Media-Server-v2
Next Generation of Node-Media-Server

## 使用

```bash
git clone -b v2 https://github.com/illuspas/Node-Media-Server.git
cd Node-Media-Server
npm i
npm test
```
## 配置说明
v2版开始使用配置文件
```json
{
  "log_level": 3,
  "gop_cache": true,
  "worker": 0,
  "http": {
    "port": 8000,
    "chunked_encoding": false
  },

  "https": {
    "port": 8443,
    "key": "./server.key",
    "cert": "./server.cert"
  }
}
```
* log_level 日志等级 0-3 
* gop_cache 否开启gopcache为播放客户端提供秒开能力
* worker 指定启动多少个worker（进程）提供服务，0为自动获取cpu核心数，不定义则使用单进程模式
* chunked_encoding 播放端是否启用chunked_encoding传输

## 特性
 * 支持http-flv 推流
 * 支持http-flv, websocket-flv 播放
 * 支持Gop Cache
 * 支持H.265 over FLV (id=12)
 * 支持auto_push多进程模式，高效利用多核
 * 支持直播时录制为flv视频
 
## 计划(挖坑)
 * 基于N-API实现内部音频转码器(speex,nellymoser,g.711 ==> AAC/OPUS，AAC <==> OPUS)
 * 或者牺牲一定性能用 WASM + worker_threads 实现转码器换来跨平台能力 ？？
 * 支持WebRtc、RTSP、RTMP推流与播放
 * PM2统计插件
 * Web管理后台
 * 支持GB28181、JT/T1078媒体格式接入
 
## 推流方式

```bash
ffmpeg -re -i STREAM.mp4 -c copy -f flv http://192.168.0.10:8000/live/stream.flv
```

## 播放方法
### ffplay vlc ...
```bash
ffplay http://192.168.0.10:8000/live/stream.flv
```
### flv.js
```html
<script src="https://cdn.bootcss.com/flv.js/1.5.0/flv.min.js"></script>
<video id="videoElement"></video>
<script>
    if (flvjs.isSupported()) {
        var videoElement = document.getElementById('videoElement');
        var flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: 'http://192.168.0.10:8000/live/stream.flv'
        });
        flvPlayer.attachMediaElement(videoElement);
        flvPlayer.load();
        flvPlayer.play();
    }
</script>
```

### 不接收音频流
```bash
ffplay http://192.168.0.10:8000/live/stream.flv\?receiveaudio\=0
```

### 不接收视频流
```bash
ffplay http://192.168.0.10:8000/live/stream.flv\?receivevideo\=0
```
