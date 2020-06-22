// Read-only access. Used for all access except to user table.
module.exports.dataRetrievalConfig = {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT),
    database: "Opedia",
    user: process.env.DB_READ_ONLY_USER,
    password: process.env.DB_READ_ONLY_PASSWORD,
    connectionTimeout: 86000000,
    requestTimeout: 86000000,
    pool: {
        idleTimeoutMillis: 86000000,
        max: 2000
    }
}

module.exports.userTableConfig = {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT),
    database: "Opedia",
    user: process.env.DB_WRITE_USER,
    password: process.env.DB_WRITE_PASSWORD,
    connectionTimeout: 50000,
    requestTimeout: 50000,
    pool: {
        idleTimeoutMillis: 50000,
        max: 2000
    }
}