/**
 * @author [Mingliang Chen]
 * @email [illuspas@gmail.com]
 * @create date 2019-01-20 00:37:42
 * @modify date 2019-01-20 00:37:42
 * @desc [description]
 */
const Fs = require('fs');
const Url = require('url');
const Http = require('http');
const Https = require('https');
const Express = require('express');
const WebSocket = require('ws');
const Logger = require('./node_core_logger');
const NodeFlvSession = require('./node_flv_session');

const HTTP_PORT = 80;
const HTTPS_PORT = 443;

class NodeHttpServer {
  constructor(ctx) {
    this.ctx = ctx;
    this.cfg = ctx.cfg;
    this.port = (this.cfg.http && this.cfg.http.port) || HTTP_PORT;
    this.sport = (this.cfg.https && this.cfg.https.port) || HTTPS_PORT;
  }

  run() {
    let app = Express();

    if (this.cfg.http) {
      this.httpServer = Http.createServer(app);
      this.httpServer.listen(this.port, () => {
        Logger.log('Node Media HTTP/WS server listen on ' + this.port);
      });
      this.wsServer = new WebSocket.Server({ server: this.httpServer });
      this.wsServer.on('connection', this.onWsConnect.bind(this));
    }

    if (this.cfg.https) {
      // openssl req -nodes -new -x509 -keyout server.key -out server.cert
      try {
        let privateKey = Fs.readFileSync(this.cfg.https.key, 'utf8');
        let certificate = Fs.readFileSync(this.cfg.https.cert, 'utf8');
        let credentials = { key: privateKey, cert: certificate };
        this.httpsServer = Https.createServer(credentials, app);
        this.httpsServer.listen(this.sport, () => {
          Logger.log('Node Media HTTPS/WSS server listen on ' + this.sport);
        });
        this.wssServer = new WebSocket.Server({ server: this.httpsServer });
        this.wssServer.on('connection', this.onWsConnect.bind(this));
      } catch (err) {
        //
      }
    }

    app.get('*', function(req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      next();
    });

    app.all('/:app/:name(([A-Za-z0-9_-]+).flv)', (req, res, next) => {
      let session = new NodeFlvSession(this.ctx, req, res);
      session.run(next);
    });
  }

  stop() {
    if (this.httpServer) {
      this.httpServer.close();
    }

    if (this.httpsServer) {
      this.httpsServer.close();
    }
  }

  onWsConnect(ws, req) {
    let wsUrl = Url.parse(req.url, true);
    let ext = wsUrl.pathname.split('.');
    if (ext[1] && ext[1] === 'flv') {
      let p = ext[0].split('/');
      if (p.length === 3) {
        req.params = { app: p[1], name: p[2] };
        req.query = wsUrl.query;
        let session = new NodeFlvSession(this.ctx, req, ws);
        session.run();
      }
    }
  }
}

module.exports = NodeHttpServer;
