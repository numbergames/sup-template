var mongoose = require('mongoose');
var bcrypt = require('bcrypt');

var userSchema = new mongoose.Schema({
  username: {
    type: String,    // mongoose.Schema.Types.Mixed
    required: true,
    unique: true
  },
  // password: {
  //   type: String,
  //   required: true
  // }
});

// userSchema.methods.validatePassword = function (password, callback) {
//   bcrypt.compare(password, this.password, function (error, isValid) {
//     if (error) {
//       callback(error);
//       return;
//     }
//     callback(null, isValid);
//   })
// };

module.exports = mongoose.model('User', userSchema);
