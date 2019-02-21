const { URL } = require('url');
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
    const pullOpt = new URL(this.pullUrl);
    pullOpt.method = 'GET';
    pullOpt.headers = { 'Connect-Type': 'nms-relay' };

    const pushURL = new URL(this.pushUrl);
    const pushOpt = {
      hostname: pushURL.hostname,
      port: pushURL.port,
      path: pushURL.pathname,
      method: 'POST',
      headers: {
        'Connect-Type': 'nms-relay'
      }
    };

    let pushReq = Http.request(pushOpt, res => {});
    let pullReq = Http.request(pullOpt, res => {
      this.isStart = true;
      this.emit('start');
      res.pipe(pushReq, { end: true });
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
