const Http = require('http');
const EventEmitter = require('events');

class NodeHttpRelay extends EventEmitter {
  constructor() {
    super();
    this.isStart = false;
  }

  pull(url) {
    this.pullUrl = url;
  }

  push(url) {
    this.pushUrl = url;
  }

  start() {
    const pullOpt = {
      method: 'GET',
      headers: {
        'Connect-Type': 'nms-relay'
      }
    };

    const pushOpt = {
      method: 'POST',
      headers: {
        'Connect-Type': 'nms-relay'
      }
    };

    let pushReq = Http.request(this.pushUrl, pushOpt);
    let pullReq = Http.get(this.pullUrl, pullOpt, res => {
      this.isStart = true;
      this.emit('start');
      res.pipe(pushReq, { end: true });
    });

    pullReq.once('close', this.stop.bind(this));
    pullReq.once('error', this.stop.bind(this));
    pushReq.once('close', this.stop.bind(this));
    pushReq.once('error', this.stop.bind(this));

    this.pullReq = pullReq;
    this.pushReq = pushReq;
  }

  stop() {
    if (this.isStart) {
      this.pullReq.destroy();
      this.pullReq = undefined;
      this.pushReq.destroy();
      this.pushReq = undefined;
      this.isStart = false;
      this.emit('stop');
    }
  }
}

module.exports = NodeHttpRelay;
