const Transform = require('stream').Transform

module.exports = class CSVStream extends Transform {
    constructor(options, recordset){
        super(options);
        this._customBuffer = [];
        this.columns = [];

        Object.keys(recordset).forEach(key => {
            this.columns[recordset[key].index] = key;
        })

        this.push(this.columns.join(','));
    }

    _transform(chunk, encoding, done) {
        console.log(chunk);
        let rowArray = [];
        this.columns.forEach(column => rowArray.push(column === 'time' ? chunk[column].toISOString().slice(0,10) : chunk[column]));
        this._customBuffer.push(rowArray.join(','));
        if(this._customBuffer.length >= 200){
            this.push(('\n') + this._customBuffer.join('\n'));
            this._customBuffer = [];
        }
        done();
    }

    _flush(done){
        if(this._customBuffer.length > 0) this.push('\n' + this._customBuffer.join('\n'));
        done();
    }
}