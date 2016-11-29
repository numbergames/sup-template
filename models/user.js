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

userSchema.methods.validatePassword = function(password) {
  // Return a new Promise object
  return new Promise((resolve, reject) => {

    // run bcrypt compare, then resolve or reject
    bcrypt.compare(password, this.password).then( valid =>  {
      // executes the promise's then()
      resolve(valid);
    }).catch( err => {
      // executes the promise's catch() 
      reject(err);
    });

  });
};

module.exports = mongoose.model('User', userSchema);
