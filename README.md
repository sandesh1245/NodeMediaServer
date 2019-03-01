# Node-Media-Server-v2
下一代Node-Media-Server，仍在开发中。

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
  },
  "record": {
    "path": "/var/data/media"
  }
}
```
* log_level 日志等级 0-3 
* gop_cache 是否开启gopcache为播放客户端提供秒开能力
* worker 指定启动多少个worker（进程）提供服务，0为自动获取cpu核心数，不定义则使用单进程模式
* http.chunked_encoding 是否为播放端开用chunked_encoding传输
* record.path 实时录制直播的保存路径

## 特性
 * 支持RTMP, http-flv 推流
 * 支持RTMP, http-flv, websocket-flv 播放
 * 支持Gop Cache
 * 支持H.265 over FLV (id=12)
 * 支持auto_push多进程模式，高效利用多核
 * 支持直播时录制为flv视频
 
## 计划(挖坑)
 * 基于N-API实现内部音频转码器(speex,nellymoser,g.711 ==> AAC/OPUS，AAC <==> OPUS)
 * 或者牺牲一定性能用 WASM + worker_threads 实现转码器换来跨平台能力 ？？
 * 支持WebRtc推流与播放
 * Session Base ultra low delay HLS
 * 支持GB28181、JT/T1078媒体格式接入
 * 统计，控制API
 * Web管理后台
 * 大小或时长分割录像

## 推流方式
```bash
ffmpeg -re -i STREAM.mp4 -c copy -f flv rtmp://192.168.0.10:1935/live/stream
```
or
```bash
ffmpeg -re -i STREAM.mp4 -c copy -f flv http://192.168.0.10:8000/live/stream.flv
```

## 播放方法
### ffplay vlc ...
```bash
ffplay rtmp://192.168.0.10:1935/live/stream
```
or
```bash
ffplay http://192.168.0.10:8000/live/stream.flv
```
### flv.js
flv.js推荐使用ws-flv播放，在微信X5内核下打开更快，无跨域问题
```html
<script src="https://cdn.bootcss.com/flv.js/1.5.0/flv.min.js"></script>
<video id="videoElement"></video>
<script>
    if (flvjs.isSupported()) {
        var videoElement = document.getElementById('videoElement');
        var flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: 'ws://192.168.0.10:8000/live/stream.flv'
        });
        flvPlayer.attachMediaElement(videoElement);
        flvPlayer.load();
        flvPlayer.play();
    }
</script>
```
