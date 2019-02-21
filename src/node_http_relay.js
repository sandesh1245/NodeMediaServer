const Http = require('http');
const EventEmitter = require('events');

class NodeHttpRelay extends EventEmitter {
  constructor() {
    super();
    this.isStart = false;
  }

  pull(host, port, path) {
    this.pullHost = host;
    this.pullPort = port;
    this.pullPath = path;
  }

  push(host, port, path) {
    this.pushHost = host;
    this.pushPort = port;
    this.pushPath = path;
  }

  start() {
    const pullOpt = {
      hostname: this.pullHost,
      port: this.pullPort,
      path: this.pullPath,
      method: 'GET',
      headers: {
        'Connect-Type': 'nms-relay'
      }
    };
    const pushOpt = {
      hostname: this.pushHost,
      port: this.pushPort,
      path: this.pushPath,
      method: 'POST',
      headers: {
        'Connect-Type': 'nms-relay'
      }
    };

    let pushReq = Http.request(pushOpt);
    let pullReq = Http.request(pullOpt, res => {
      this.isStart = true;
      this.emit('start');
      res.pipe(
        pushReq,
        { end: true }
      );
    });

    pullReq.once('close', this.stop.bind(this));
    pullReq.once('error', this.stop.bind(this));
    pushReq.once('close', this.stop.bind(this));
    pushReq.once('error', this.stop.bind(this));
    pullReq.end();
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
