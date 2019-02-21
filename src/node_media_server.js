/**
 * @author [Mingliang Chen]
 * @email [illuspas@gmail.com]
 * @create date 2019-01-20 00:31:39
 * @modify date 2019-01-20 00:31:39
 * @desc [description]
 */

const Cluster = require('cluster');
const EventEmitter = require('events');
const numCPUs = require('os').cpus().length;
const Logger = require('./node_core_logger');
const NodeIpcServer = require('./node_ipc_server');
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
    if (Cluster.isMaster) {
      if (typeof this.ctx.cfg.worker === 'number') {
        Logger.log(`Master ${process.pid} is running`);

        const messageHandler = msg => {
          for (let id in Cluster.workers) {
            Cluster.workers[id].send(msg);
          }
        };
  
        const newWorker = () => {
          let worker = Cluster.fork();
          worker.on('message', messageHandler);
        };
        const num = this.ctx.cfg.worker > 0 ? this.ctx.cfg.worker : numCPUs;
        for (let i = 0; i < num; i++) {
          newWorker();
        }

        Cluster.on('exit', (worker, code, signal) => {
          Logger.log(`Worker ${worker.process.pid} died`);
          newWorker();
        });
      } else {
        this.runWorker();
      }
    } else {
      Logger.log(`Worker ${process.pid} is running`);
      this.runWorker();
    }
  }

  runWorker() {
    Logger.setLogLevel(this.ctx.cfg.log_level);
    if (this.ctx.cfg.http || this.ctx.cfg.https) {
      let httpServer = new NodeHttpServer(this.ctx);
      httpServer.run();
      this.servers.push(httpServer);
    }
    if (typeof this.ctx.cfg.worker === 'number') {
      let ipcServer = new NodeIpcServer(this.ctx);
      ipcServer.run();
      this.servers.push(ipcServer);
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
