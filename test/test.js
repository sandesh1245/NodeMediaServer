const NodeMediaServer = require('../');
const config = require('./config.json');

let nms = new NodeMediaServer(config);
nms.run();
