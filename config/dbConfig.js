// Define database connection configs
// used by node-mssql connection

// node "DB_SERVER" is "Ranier"
// validator interactions use Ranier exclusively

const baseConfig = {
  port: Number(process.env.DB_PORT),
  database: "Opedia",
  pool: {
    idleTimeoutMillis: 30000,
    min: 3,
    max: 500,
  },
  options: {
    trustServerCertificate: true,
  },
};

const readerConfig = {
  user: process.env.DB_READ_ONLY_USER,
  password: process.env.DB_READ_ONLY_PASSWORD,
};

// only user table uses write access
const writerConfig = {
  user: process.env.DB_WRITE_USER,
  password: process.env.DB_WRITE_PASSWORD,
};

// timeouts are in ms
const connectionTimeout30Seconds = {
  connectionTimeout: 30 * 1000,
};

const connectionTimeout50Seconds = {
  connectionTimeout: 50 * 1000,
};

const requestTimeoutVeryLong = {
  requestTimeout: 86000000, // almost 24 hours
};

const requestTimeout50Seconds = {
  requestTimeout: 50 * 1000,
};

// servers

// 1. Data Retrieval
module.exports.dataRetrievalConfig = Object.assign(
  {},
  baseConfig,
  readerConfig,
  connectionTimeout30Seconds,
  requestTimeoutVeryLong,
  {
    server: process.env.DB_SERVER,
    pool: {
      idleTimeoutMillis: 30000,
      min: 3,
      max: 500,
    },
  }
);

// 2. User Table
module.exports.userTableConfig = Object.assign(
  {},
  baseConfig,
  writerConfig,
  connectionTimeout50Seconds,
  requestTimeout50Seconds,
  {
    server: process.env.DB_SERVER,
    pool: {
      idleTimeoutMillis: 50000,
      min: 3,
      max: 500,
    },
  }
);

// 3. Mariana
module.exports.mariana = Object.assign(
  {},
  baseConfig,
  readerConfig,
  connectionTimeout50Seconds,
  requestTimeoutVeryLong,
  {
    server: process.env.MARIANA_SERVER,
    pool: {
      idleTimeoutMillis: 50000,
      min: 3,
      max: 500,
    },
  }
);

// 4. Rossby
module.exports.rossby = Object.assign(
  {},
  baseConfig,
  readerConfig,
  connectionTimeout50Seconds,
  requestTimeoutVeryLong,
  {
    server: process.env.ROSSBY_SERVER,
    pool: {
      idleTimeoutMillis: 50000,
      min: 3,
      max: 500,
    },
  }
);
