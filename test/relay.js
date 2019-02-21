const NodeHttpRelay = require('../src/node_http_relay');

let nhr = new NodeHttpRelay();

nhr.play('http://192.168.0.8:8000/live/s.flv');
// nhr.publish('http://192.168.0.8:8000/live/s.flv');
nhr.publish('http://192.168.0.8:8000/live/s1.flv');
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