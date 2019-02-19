/**
 * @author [Mingliang Chen]
 * @email [illuspas@gmail.com]
 * @create date 2019-01-20 00:31:39
 * @modify date 2019-01-20 00:31:39
 * @desc [description]
 */

const EventEmitter = require('events');
const Logger = require('./node_core_logger');
const NodeHttpServer = require('./node_http_server');

class NodeMediaServer {
  constructor(config) {
    this.ctx = {};
    this.ctx.cfg = config;
    this.ctx.eve = new EventEmitter();
    this.ctx.evt = new EventEmitter();
    this.ctx.ses = new Map();
    this.ctx.pbs = new Map();
    this.ctx.idl = new Set();
    this.servers = [];
  }

  run() {
    Logger.setLogLevel(this.ctx.cfg.log_level);
    if (this.ctx.cfg.http || this.ctx.cfg.https) {
      let httpServer = new NodeHttpServer(this.ctx);
      httpServer.run();
      this.servers.push(httpServer);
    }
  }

  stop() {
    this.servers.forEach(server => {
      server.stop();
    });
    this.servers.length = 0;
  }

  on(event, callback) {
    this.ctx.evt.on(event, callback);
  }
}

module.exports = NodeMediaServer;
