const Transform = require('stream').Transform;

// Only used in old /dataretrieval routes, which are no longer used by the web app. Can be deleted if SDKs are using /data
module.exports = class CustomTransform extends Transform {
  constructor() {
    super();
    this._customBuffer = '';
  }

  _transform(chunk, encoding, done) {
    this._customBuffer += chunk.toString();
    if (this._customBuffer.length >= 4500) {
      this.push(this._customBuffer);
      this._customBuffer = '';
    }
    done();
  }

  _flush(done) {
    if (this._customBuffer.length > 0) this.push(this._customBuffer);
    done();
  }
};
