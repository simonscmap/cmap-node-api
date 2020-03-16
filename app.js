const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const passport = require('./middleware/passport');
var useragent = require('express-useragent');

const userRoutes = require('./routes/user');
const dataRoutes = require('./routes/data');
const dataRetrievalRoutes = require('./routes/dataRetrieval');
const catalogRoutes = require('./routes/catalog');
const communityRoutes = require('./routes/community');

const ApiCallDetails = require('./models/ApiCallDetail');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors({origin:true, credentials:true}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(useragent.express());

// Attaching call details to request object for usage tracking
app.use((req, res, next) => {
    req.cmapApiCallDetails = new ApiCallDetails(req);
    req.cmapApiCallDetails.checkIp();
    next();
})

// Routes - DEPRECATED
app.use('/user', userRoutes);
app.use('/dataretrieval', passport.authenticate(['headerapikey', 'jwt'], {session: false}), dataRetrievalRoutes);

app.get('/', (req, res, next) => {
    res.cmapSkipCatchAll = true;
    res.sendFile(__dirname + '/public/landing/landing.html', null, (err) => {
        if(err) next(err);
        else next();
    });
})

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/data', passport.authenticate(['headerapikey', 'jwt'], {session: false}), dataRoutes);
app.use('/api/catalog', catalogRoutes);

// Usage metrics logging
app.use((req, res, next) => {
    req.cmapApiCallDetails.save();
    next();
});

app.use((req, res, next) => {
    if(!res.headersSent && !res.cmapSkipCatchAll) {
        res.sendFile(__dirname + '/public/app.html', null, (err) => {
            if(err) next(err);
            else next();
        });
    }
})

app.use((err, req, res, next) => {
    console.log('an error occurred in the catch-all')
    console.log(err);
    if(!res.headersSent && !res.cmapSkipCatchAll) res.status(500).send();
})

var server = app.listen(port, ()=>{console.log(`listening on port ${port}`)});

// Super long timeout for testing
server.timeout = 84000000;