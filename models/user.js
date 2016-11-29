var mongoose = require('mongoose');
// var bcrypt = require('bcrypt');
var bcrypt = require('bcrypt-as-promised');


var userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  }
});

userSchema.methods.validatePassword = function (password, callback) {
  bcrypt.compare(password, this.password)
  .then(isValid => {
    callback(null, isValid);
  })
  .catch(callback);
};

module.exports = mongoose.model('User', userSchema);
