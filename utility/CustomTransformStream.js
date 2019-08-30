const Transform = require('stream').Transform

module.exports = class CustomTransform extends Transform {
    constructor(){
        super();
        this._customBuffer = '';
    }


    _transform(chunk, encoding, done) {
        this._customBuffer += chunk.toString();
        if(this._customBuffer.length >= 4500){            
            this.push(this._customBuffer);
            this._customBuffer = '';
        }
        done();
    }

    _flush(done){
        if(this._customBuffer.length > 0) this.push(this._customBuffer);
        done();
    }
}