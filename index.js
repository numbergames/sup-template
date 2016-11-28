var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var app = express();

var DATABASE_URL = 'mongodb://localhost/sup';

var User = require('./models/user');
var Message = require('./models/message');

var bcrypt = require('bcrypt');
var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;

app.use(bodyParser.json());

var basicStrategy = new BasicStrategy(function (username, password, callback) {
  User.findOne({ username: username }, function (error, user) {
    if (error) {
      return callback(error);
    }
    if (!user) {
      return callback(null, false, { message: "Incorrect username" });
    }
    user.validatePassword(password, function (error, isValid) {
      if (error) {
        return callback(error);
      }
      if (!isValid) {
        return callback(null, false, { message: "Incorrect password" });
      }
      return callback(null, user);
    })
  });
});

passport.use(basicStrategy);

// ================ User Routes ===================

// production: remove password hashes from returned user list
// 
app.get('/hidden', passport.authenticate('basic', {
    session: false
}), function (req, res) {
    res.json({
        message: 'Luke... I am your father'
    });
}); 

app.get('/users', (req, res) => {
  User.find()
  .then(users => {
    res.status(200).json(users);
  });
});

// production: authenticate & return full user object?
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

// get password, hash it, save it
app.post('/users', function (req, res) {
  var {username, password} = req.body;
  bcrypt.genSalt(10, function(error, salt) {
    if (error) {
      return res.status(500).json({message: 'Internal server error'});
    }
    bcrypt.hash(password, salt, function(error, hash) {
      if (error) {
        return res.status(500).json({message: 'Internal server error'});
      }
      var newUser = {username: username,
        password: hash};

      User.create(newUser)
      .then(function(item) {
        res.location(`/users/${item._id}`).status(201).json({});
      })
      .catch(function(err) {
        console.log(err.errors);
        res.status(422).json({ message: "Mongoose save threw an error" });
      });
    })
  })
});

// handle password change in addition to name change
// production: require authentication before changes
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

// production: authenticate first
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

// ?? disable global message query in production?
// production: authenticate user, return only that user's messages
app.get('/messages', (req, res) => {
  Message.find(req.query)
  .populate('from')
  .populate('to')
  .then(messages => {
    res.status(200).json(messages);
  });
});

// production: authenticate the 'from' user
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

// production: authenticate either to or from
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
