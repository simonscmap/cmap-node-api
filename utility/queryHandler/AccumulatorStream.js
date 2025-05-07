const Transform = require('stream').Transform;

// Allows a larger buffer than default stream, reduces number of write operations

module.exports = class AccumulatorStream extends Transform {
  constructor(options) {
    super(options);
    this._customBuffer = [];
  }

  _transform(chunk, encoding, done) {
    this._customBuffer.push(chunk);
    if (this._customBuffer.length >= 100) {
      this.push(this._customBuffer.join(''));
      this._customBuffer = [];
    }
    done();
  }

  _flush(done) {
    this.push(this._customBuffer.join('') + '\n');
    done();
  }
};
