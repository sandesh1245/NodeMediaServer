const NodeHttpRelay = require('../src/node_http_relay');

let nhr = new NodeHttpRelay();

nhr.pull('http://localhost:51214/live/s.flv');
// nhr.push('http://192.168.0.8:8000/live/s.flv');
nhr.push('http://localhost:51215/live/s.flv');
nhr.start();
nhr.on('start',()=>{
  console.log('relay start');
});

nhr.on('stop',()=>{
  console.log('relay stop');
});

// setTimeout(() => {
//   nhr.stop();
// }, 10000);