const Transform = require('stream').Transform

module.exports = class AccumulatorStream extends Transform {
    constructor(options){
        super(options);
        this._customBuffer = [];
    }

    _transform(chunk, encoding, done) {
        this._customBuffer.push(chunk);
        if(this._customBuffer.length >= 200){
            this.push(this._customBuffer.join(''));
            this._customBuffer = [];
        }
        done();
    }

    _flush(done){
        this.push(this._customBuffer.join('') + '\n');
        done();
    }
}