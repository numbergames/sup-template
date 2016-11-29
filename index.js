var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var app = express();

// var DATABASE_URL = 'mongodb://localhost/sup';
var DATABASE_URL = 'mongodb://localhost/sup-dev';

var User = require('./models/user');
var Message = require('./models/message');

var bcrypt = require('bcrypt');
var bcryptp = require('bcrypt-as-promised');
var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;

app.use(bodyParser.json());

var basicStrategy = new BasicStrategy((username, password, done) => {
  // Note 'callback' is passport's built-in function named 'verified'
  // https://github.com/jaredhanson/passport-http/blob/f7a163f5d47c96c0be74d9af30c1c0b376cc57d9/lib/passport-http/strategies/basic.js#L88

  User.findOne({ username: username }).then( user => {

    if (!user) return done(null, false);

    user.validatePassword(password).then( isValid => {

      if (!isValid) {return done(null, false);}
      done(null, user);

    }).catch(
    console.log('====== HERE =====')
      (err) => {return done(null, false, {message: 'not valid'})}
    );
  })

  .catch(done);
});

passport.use(basicStrategy);

// ================ User Routes ===================

var compIds = (id, ...comps) => comps.some(comp => id.toString() === comp.toString());

app.get('/user-dev', (req, res) => {
  User.find()
  .then(users => {
    res.status(200).json(users);
  });
});

// production: remove password hashes from returned user list
app.get('/users', (req, res) => {
  User.find().select('username')
  .then(users => {
    //var usernames = users.map(user => user.username);
    res.status(200).json(users);
  });
});

// production: authenticate & return full user object?
app.get('/users/:_id', passport.authenticate('basic', {session: false}), (req, res) => {
  if (!compIds(req.user._id, req.params._id)) {
    return res.status(401).json({message: 'Unauthorised'});
  }
  User.findById(req.params._id)
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

  if (!username || typeof username !== 'string') {
    return res.status(422).json({message: 'Missing or incorrect field: username'});
  }
  if (!password || typeof password !== 'string') {
    return res.status(422).json({message: 'Missing or incorrect field: password'});
  }
  User.findOne({username: username}, function (error, user) {
    if (user) {
    return res.status(422).json({message: 'Duplicate user'});
    }
  })

  bcrypt.genSalt(10, function (error, salt) {
    if (error) {
      return res.status(500).json({message: 'Internal server error'});
    }
    bcrypt.hash(password, salt, function (error, hash) {
      if (error) {
        return res.status(500).json({ message: 'Internal server error' });
      }
      var newUser = {
        username: username,
        password: hash
      };

      User.create(newUser)
      .then(function(item) {
        res.location(`/users/${item._id}`).status(201).json({});
      })
      .catch(function(err) {
        // console.log(err.errors);
        res.status(422).json({ message: "Mongoose save threw an error" });
      });
    });
  });
});

// handle password change in addition to name change
// production: require authentication before changes
app.put('/users/:_id', passport.authenticate('basic', {session: false}), (req, res) => {
  if (!compIds(req.user._id, req.params._id)) {
    return res.status(401).json({message: 'Unauthorised'});
  }
  var newUser = {};

  if (username && typeof username !== 'string') {
    return res.status(422).json({message: 'Missing or incorrect field: username'});
  }
  if (password && typeof password !== 'string') {
    return res.status(422).json({message: 'Missing or incorrect field: password'});
  }

  if (req.body.username) {
    console.log('has username', req.body.username);
    newUser.username = req.body.username;
  }

  if (req.body.password) {
    bcryptp.genSalt(10)
    .then((salt) => {
      return bcryptp.hash(req.body.password, salt);
    })
    .then(hash => {
      console.log(hash);
      newUser.password = hash;
      return User.findOneAndUpdate(
        req.params,
        newUser
      )
    })
    .then(user => {
      return res.status(200).json({});
    })
    .catch(error => {
      console.log('error in promise');
    });
  } else {
    User.findOneAndUpdate(
      req.params,
      newUser
    )
    .then(user => {
      return res.status(200).json({});
    })
    .catch(error => {
      console.log('error in 2nd promise');
    });
  }
});

// production: authenticate first
app.delete('/users/:_id', passport.authenticate('basic', {session: false}), function(req, res) {
  // console.log('delete', req.user);
    console.log("I caught it");
  if (!compIds(req.user._id, req.params._id)) {
    return res.status(401).json({ message: 'Unauthorised' });
  }
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
app.get('/messages', passport.authenticate('basic', {session: false}), (req, res) => {
  console.log(req.query)
  // do user's query
  // filter results on authed users name (either in from or to)
  var authId = req.user._id.toString();

  Message.find(req.query)
  .populate('from')
  .populate('to')
  .then(messages => {
    var userMessages = messages.filter(
      message => message.from._id.toString() === authId ||
      message.to._id.toString() === authId);

      res.status(200).json(userMessages);
    });
  });

// curl -X POST -u bob:easy -H "Content-Type: application/json" -d {"from":"583c835c8628406d25d7519b", "to":"583c8792c759b76dba78e5a5", "text":"auth message"}' http://localhost:8080/messages

// production: authenticate the 'from' user
app.post('/messages', passport.authenticate('basic', {session: false}), (req, res) => {
  console.log(req.user);

  new Promise((resolve, reject) => {
    if (!req.body.text) {
      reject('Missing field: text');
    }

    for (property in req.body) {
      if (typeof req.body[property] !== "string") {
        reject(`Incorrect field type: ${property}`);
      }
    }

    if (req.body.from !== req.user._id.toString()) {
      reject('Did not authenticate as the "from" user.');
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
app.get('/messages/:_id', passport.authenticate('basic', {session: false}), (req, res) => {
  var authId = req.user._id;
  Message.findOne(req.params)
  .populate('from')
  .populate('to')
  .then(message => {
    if (message) {
      if (compIds(authId, message.from._id, message.to._id)) {
        res.status(200).json(message);
      } else {
        return res.json({message: 'Unauthorised'});
      }
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
