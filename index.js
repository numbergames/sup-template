var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var app = express();

var DATABASE_URL = 'mongodb://localhost/sup';

var User = require('./models/user');
var Message = require('./models/message');

app.use(bodyParser.json());

// ================ User Routes ===================

app.get('/users', (req, res) => {
  User.find()
  .then(users => {
    res.status(200).json(users);
  });
});

app.get('/users/:userId', (req, res) => {
  User.findById(req.params.userId)
  .then((item) => {
    if (item) {
      res.status(200).json(item);
    } else {
      res.status(404).json({message: 'User not found'});
    }
  });
});

app.post('/users', function (req, res) {
  User.create(req.body)
  .then(function(item) {
    res.location(`/users/${item._id}`).status(201).json({});
  })
  .catch(function(err) {
    res.status(422).json({ message: err.errors.username.message });
  });
});

app.put('/users/:_id', (req, res) => {
  User.findOneAndUpdate(
    req.params,
    { username: req.body.username },
    { upsert: true, runValidators: true }
  )
  .then(user => {
    res.status(200).json({});
  })
  .catch(err => {
    res.status(422).json({ message: err.errors.username.message });
  });
});

app.delete('/users/:_id', function(req, res) {
  User.findOneAndRemove(req.params)
  .then(user => {
    if (!user) {
      res.status(404).json({ message: 'User not found' });
    } else {
      res.status(200).json({});
    }
  });
});

// ============ Message Routes ======================

app.get('/messages', (req, res) => {
  Message.find(req.query)
  .populate('from')
  .populate('to')
  .then(messages => {
    res.status(200).json(messages);
  });
});

app.post('/messages', (req, res) => {

  new Promise((resolve, reject) => {
    if (!req.body.text) {
      reject('Missing field: text');
    }

    for (property in req.body) {
      if (typeof req.body[property] !== "string") {
        reject(`Incorrect field type: ${property}`);
      }
    }

    resolve(Promise.all([
      User.findById(req.body.from),
      User.findById(req.body.to)
    ]));
  })

  .then(results => {
    if (!results[0]) {
      return Promise.reject('Incorrect field value: from');
    }
    if (!results[1]) {
      return Promise.reject('Incorrect field value: to');
    }

    return Message.create(req.body);
  })

  .then(msg => {
    res.status(201).location(`/messages/${msg._id}`).json({});
  })

  .catch(err => {
    res.status(422).json({ message: err });
  });

});

app.get('/messages/:_id', (req, res) => {
  Message.findOne(req.params)
  .populate('from')
  .populate('to')
  .then(message => {
    if (message) {
      res.status(200).json(message);
    } else {
      res.status(404).json({ message: 'Message not found' });
    }
  });
});

function runServer(callback) {
  var databaseUri = process.env.DATABASE_URI || global.databaseUri || DATABASE_URL;
  mongoose.connect(databaseUri).then(function() {
    var port = process.env.PORT || 8080;
    var server = app.listen(port, function() {
      console.log('Listening on port', port);
      if (callback) {
        callback(server);
      }
    });
  });
}

if (require.main === module) {
  runServer();
};

exports.app = app;
exports.runServer = runServer;
