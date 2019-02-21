const Http = require('http');
const Express = require('express');
const Logger = require('./node_core_logger');
const NodeFlvSession = require('./node_flv_session');

class NodeIpcServer {
  constructor(ctx) {
    this.ctx = ctx;
    this.ipcPort = 0;
  }

  run() {
    let app = Express();
    
    this.ipcServer = Http.createServer(app);
    this.ipcServer.listen(0, '127.0.0.1', () => {
      this.ipcPort = this.ipcServer.address().port;
      Logger.log('Node Media IPC Server listen on', this.ipcPort);
    });

    app.all('/:app/:name(([A-Za-z0-9_-]+).flv)', (req, res, next) => {
      let session = new NodeFlvSession(this.ctx, req, res);
      session.run(next);
    });
  }

  stop() {
    this.ipcServer.close();
  }
}

module.exports = NodeIpcServer;
