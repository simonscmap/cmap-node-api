require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const passport = require('./middleware/passport');
var useragent = require('express-useragent');
const createNewLogger = require('./log-service');
const webApp = require('./routes/webApp');
const apiRouter = require('./routes/api');
const dataRetrievalRoutes = require('./routes/dataRetrieval');
const ApiCallDetails = require('./models/ApiCallDetail');
const { v4: uuidv4 } = require('uuid');

const { monitor } = require('./mail-service/checkBouncedMail');
const env = require('./config/environment');

// on startup, check for bounced mail
monitor();
monitor();

const log = createNewLogger()
  .setModule('app.js')
  .addContext(['node_version', process.version]);

log.info('starting app', {
  DEBUG_USAGE: process.env.DEBUG_USAGE,
  DEBUG_USAGE_THROTTLE_MS: process.env.DEBUG_USAGE_THROTTLE_MS,
  CLUSTER_CHUNK_MAX_ROWS: process.env.CLUSTER_CHUNK_MAX_ROWS,
});

const app = express();
const port = process.env.PORT || 8080;

process.on('warning', ({ name, message, stack }) => {
  log.warn(message, { name, stack });
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(useragent.express());

// Create a request id
app.use((req, res, next) => {
  let reqId = uuidv4();
  req.requestId = reqId;
  res.set('X-CMAP-Request-Id', reqId);
  next();
});

// Attaching call details to request object for usage tracking
app.use((req, res, next) => {
  req.cmapApiCallDetails = new ApiCallDetails(req);
  req.cmapApiCallDetails.checkIp();
  next();
});

// Routes - DEPRECATED
app.use(
  '/dataretrieval',
  passport.authenticate(['headerapikey', 'jwt'], { session: false }),
  dataRetrievalRoutes,
);

// API
app.use('/api', apiRouter);

// Web App
app.use(webApp);

// Usage metrics logging
app.use((req, res, next) => {
  // this will execute if neither the api nor webApp have already saved call details
  req.cmapApiCallDetails.save(res, { caller: 'app' });
  next();
});

// start web server
app.listen(port, () => {
  log.info('api web server started', {
    port,
    nodeEnv: env.NODE_ENV,
  });
});
