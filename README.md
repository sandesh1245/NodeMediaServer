# Node-Media-Server-v2
Next Generation of NodeMediaServer

## 特性
 * 支持http-flv 推流
 * 支持http-flv, websocket-flv 播放
 * 支持Gop Cache

## 推流方式

```base
ffmpeg -re -i STREAM.mp4 -c copy -f flv http://192.168.0.10:8000/live/stream.flv
```

## 播放方法

```base
ffplay http://192.168.0.10:8000/live/stream.flv
```

