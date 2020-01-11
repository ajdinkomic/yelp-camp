var mongoose = require("mongoose");

var notificationSchema = new mongoose.Schema({
  username: String,
  campgroundSlug: String,
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Notification", notificationSchema)