const Net = require('net');
const Logger = require('./node_core_logger');
const NodeRtmpSession = require('./node_rtmp_session');

const RTMP_PORT = 1935;

class NodeRtmpServer {
  constructor(ctx) {
    this.ctx = ctx;
    this.cfg = ctx.cfg;
    this.port = this.cfg.rtmp.port || RTMP_PORT;
  }

  run() {
    this.rtmpServer = Net.createServer(socket => {
      let session = new NodeRtmpSession(this.ctx, socket);
      session.run();
    });
    this.rtmpServer.listen(this.port, '0.0.0.0', () => {
      Logger.log('Node Media Rtmp server listen on ' + this.port);
    });
  }

  stop() {
    if (this.rtmpServer) {
      this.rtmpServer.close();
    }
  }
}

module.exports = NodeRtmpServer;
