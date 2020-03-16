// Not currently in use. Retained for reference.

const Transform = require('stream').Transform

// Class for a transform stream which converts database responses to
// stringified json. Constructor accepts a responses object and adds
// handlers and pipe.
module.exports = class JsonTransformStream extends Transform{
    constructor(res){
        super({objectMode : true});

        this.count = 0;

        // In cases where we want to finish streaming before continuing
        // we can await this promise. The event listeners work the same
        // either way.
        this.awaitableStreamEnd = new Promise((resolve, reject) => {
            this.on('error', err => {
                res.end(JSON.stringify(err));
                reject();
            });

            this.once('end', () => {
                res.end();
                resolve();
            })
        })
       
        this.pipe(res);

        res.writeHead(200, {
            'Transfer-Encoding': 'chunked',
            'charset' : 'utf-8',
            'Content-Type': 'application/json'            
        })
    }

    _transform(chunk, encoding, done) {
        if(this.count === 0) console.log(JSON.stringify(chunk))
        this.count ++;
        this.push(JSON.stringify(chunk));
        done();
    }

    _flush(done){
        done();
    }
}
