const sql = require('mssql');
const ndjson = require('ndjson');
var pools = require('./dbPools');
const zlib = require('zlib');
const CustomTransformStream = require('../utility/CustomTransformStream');

module.exports =  async (query, res) => { 
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    const ndjsonStream = ndjson.serialize();
    const gzip = zlib.createGzip();
    const transformer = new CustomTransformStream();

    request.pipe(ndjsonStream)
        .pipe(transformer)
        .pipe(gzip)
        .pipe(res)

    res.writeHead(200, {
        'Transfer-Encoding': 'chunked',
        'charset' : 'utf-8',
        'Content-Type': 'application/json',      
        'Content-Encoding': 'gzip'            
    })

    // .pipe does not close on error so we need to close all the streams conditionally when the response ends

    request.query(query);
    request.on('error', err => {res.end(JSON.stringify(err))});
};