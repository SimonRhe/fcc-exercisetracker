//
//
// Exercise Tracker for freeCodeCamp
// by Simon Rhe, March 2020
//
//

require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');
const mongo = require('mongodb');
const mongoose = require('mongoose');

// Connect to database
const MONGO_URI = process.env.MONGO_URI; // MongoDB Atlas URI, username and password is stored in .env file
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error: '));
db.once('open', function() {
  console.log('Connection successful! readyState: ' + db.readyState);
});

// Define schema and model for user, log entry
const userSchema = new mongoose.Schema({
  username: {type: String, required: true},
});
const UserEntry = mongoose.model('user', userSchema); // note: Mongoose automatically looks for the plural, lowercased version of your model name.

const logSchema = new mongoose.Schema({
  userid: {type: String, required: true},
  date: {type: Date, required: true},
  duration: {type: Number, required: true},
  description: {type: String, required: true},
});
const LogEntry = mongoose.model('log', logSchema);

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// User story 1: create a user
app.post('/api/exercise/new-user', function(req, res) {
  const username = req.body.username;
  const newUser = new UserEntry({username: username});
  newUser.save((err, data) => {
    if (err) return console.error(err);
    console.log('User successfully created! Data ' + data);
    res.json({
      username: username,
      _id: data._id,
    });
  });
});

// User story 2: array of all users
app.get('/api/exercise/users', function(req, res) {
  UserEntry.find({}).select('username _id').exec((err, data) => {
    if (err) return console.error(err);
    res.json(data);
  });
});

// User story 3: add exercise
app.post('/api/exercise/add', (req, res) => {
  const userId = req.body.userId;
  const description = req.body.description;
  const duration = parseInt(req.body.duration);
  let date = req.body.date;

  if (userId == '' || userId == undefined) {
    return res.send('Error: must supply userId');
  }
  if (description == '' || description == undefined) return res.send('Error: must supply description');
  if (isNaN(duration)) return res.send('Error: must supply duration');

  if (date == '' || date == undefined) {
    date = new Date();
  } else {
    date = new Date(date);
    console.log('Parsed date: ' + date);
    if (isNaN(date)) return res.send('Error: invalid date');
  }

  UserEntry.findById(userId, (err, userDoc) => {
    if (err) return res.send('Error: userId not found; ' + err);
    const newLog = new LogEntry({
      userid: userId,
      date: date,
      duration: duration,
      description: description,
    });
    newLog.save((err, newLogDoc) => {
      if (err) return res.send('Error: could not save new log entry; ' + err);
      return res.json({
        _id: userDoc._id,
        username: userDoc.username,
        description: description,
        duration: duration,
        date: date.toDateString(),
      });
    });
  });
});

// User story 4 & 5: retrieve full exercise log, specify dates, limit
// e.g.: /api/exercise/log?userId=HJQFfkGHU
app.get('/api/exercise/log', (req, res) => {
  const userId = req.query.userId;
  const fromDate = new Date(req.query.from);
  const toDate = new Date(req.query.to);
  const limit = parseInt(req.query.limit);

  UserEntry.findById(userId).select('username').exec((err, userDoc) => {
    if (err) return res.send('Error: userId not found; ' + err);

    // find all log entries for user
    const logQuery = LogEntry.find({userid: userId})
        .select('description duration date');
    if (!isNaN(limit)) {
      console.log('here!');
      logQuery.limit(limit);
    }
    if (!isNaN(fromDate)) {
      logQuery.where('date').gte(fromDate);
    }
    if (!isNaN(toDate)) {
      logQuery.where('date').lte(toDate);
    }
    logQuery.exec((err, logEntries) => {
      if (err) return res.send('Error in getting log entries; ' + err);
      const processedLogEntries = logEntries.map((e) => {
        return {
          description: e.description,
          duration: e.duration,
          date: e.date.toDateString(),
        };
      });
      return res.json({
        ...userDoc.toObject(),
        count: logEntries.length,
        log: processedLogEntries,
      });
    });
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'});
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode;
  let errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).type('txt').send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
  console.log('db readyState: ' + db.readyState);
});
