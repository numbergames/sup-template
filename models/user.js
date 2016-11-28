var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  username: {
    type: {},    // mongoose.Schema.Types.Mixed
    validate: [
      v => typeof v === 'string',
      "Incorrect field type: username"
    ],
    required: [
      true,
      "Missing field: username"
    ]
  }
});

module.exports = mongoose.model('User', userSchema);
