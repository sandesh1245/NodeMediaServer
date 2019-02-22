const Fs = require('fs');
const Path = require('path');
const Mkdirp = require('mkdirp');
const Logger = require('./node_core_logger');
const { genFormatTime } = require('./node_core_utils');
const NodeFlvSession = require('./node_flv_session');

class NodeRecordServer {
  constructor(ctx) {
    this.ctx = ctx;
    this.cfg = ctx.cfg;
    this.evt = ctx.evt;
    this.savePath = this.cfg.record.path;
  }

  run() {
    try {
      if (!Path.isAbsolute(this.cfg.record.path)) {
        throw { message: 'The record path must be an absolute path' };
      }
      Mkdirp.sync(this.cfg.record.path);
      Fs.accessSync(this.cfg.record.path, Fs.constants.W_OK);
      this.evt.on('postPublish', this.onPostPublish.bind(this));
      Logger.log('Node Media Record Server save in path', this.savePath);
    } catch (error) {
      Logger.error(`Node Media Record Server startup failed. Error:${error.message}`);
    }
  }

  stop() {}

  onPostPublish(id, arg) {
    let filePath = `${this.savePath}/${arg.streamPath}`;
    let fileName = `VID_${genFormatTime()}.flv`;
    Mkdirp.sync(filePath);
    let req = {
      headers: {},
      method: 'GET',
      params: {
        app: arg.streamApp,
        name: arg.streamName
      },
      query: {},
      socket: {}
    };
    Logger.log(`New Record ${arg.streamPath} to ${filePath}/${fileName}`);

    let res = Fs.createWriteStream(filePath + '/' + fileName);
    let session = new NodeFlvSession(this.ctx, req, res);
    session.run();
  }
}

module.exports = NodeRecordServer;
