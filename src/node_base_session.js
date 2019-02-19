/**
 * @author [Mingliang Chen]
 * @email [illuspas@gmail.com]
 * @create date 2019-01-20 08:05:44
 * @modify date 2019-01-20 08:05:44
 * @desc [description]
 */
const { genSessionID } = require('./node_core_utils');

class NodeBaseSession {
  constructor(stream) {
    this.stream = stream;
    this.id = genSessionID();
    this._resolve = () => {};
    this._reject = () => {};
  }

  readStream(size) {
    return new Promise((resolve, reject) => {
      this._reject = reject;
      const onReadable = () => {
        let chunk = this.stream.read(size);
        if (chunk != null) {
          this.stream.removeListener('readable', onReadable);
          resolve(chunk);
        }
      };
      this.stream.on('readable', onReadable);
      onReadable();
    });
  }

  stopStream() {
    this._reject('stopStream');
  }

  waitIdle() {
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  stopIdle() {
    this._resolve('stopIdle');
  }
}

module.exports = NodeBaseSession;
