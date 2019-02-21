const Http = require('http');
const Express = require('express');
const Logger = require('./node_core_logger');
const NodeFlvSession = require('./node_flv_session');
const NodeHttpRelay = require('./node_http_relay');

class NodeIpcServer {
  constructor(ctx) {
    this.ctx = ctx;
    this.evt = ctx.evt;
    this.ipcPort = 0;
  }

  run() {
    let app = Express();

    this.ipcServer = Http.createServer(app);
    this.ipcServer.listen({ port: 0, host: '127.0.0.1', exclusive: true }, () => {
      this.ipcPort = this.ipcServer.address().port;
      Logger.log('Node Media IPC Server listen on', this.ipcPort);
    });

    app.all('/:app/:name(([A-Za-z0-9_-]+).flv)', (req, res, next) => {
      let session = new NodeFlvSession(this.ctx, req, res);
      session.run(next);
    });

    this.evt.on('postPublish', (id, arg) => {
      process.send({ cmd: 'postPublish', pid: process.pid, port: this.ipcPort, streamPath: arg.streamPath });
    });

    process.on('message', (msg) => {
      if (this.ipcPort === msg.port) {
        Logger.debug('Current process, ignore');
        return;
      }

      Logger.debug(`IPC receive message from pid=${msg.pid} cmd=${msg.cmd} port=${msg.port} streamPath=${msg.streamPath}`);

      if (msg.cmd === 'postPublish') {
        let pullPath = `http://127.0.0.1:${msg.port}${msg.streamPath}.flv`;
        let pushPath = `http://127.0.0.1:${this.ipcPort}${msg.streamPath}.flv`;
        let relaySession = new NodeHttpRelay();
        console.log(pullPath,pushPath);
        relaySession.pull(pullPath);
        relaySession.push(pushPath);
        relaySession.start();
      }

    });
  }

  stop() {
    this.ipcServer.close();
  }
}

module.exports = NodeIpcServer;
