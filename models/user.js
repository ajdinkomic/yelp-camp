const mongoose = require("mongoose"),
    pasportLocalMongoose = require("passport-local-mongoose"),

    UserSchema = new mongoose.Schema({
        username: {
            type: String,
            unique: true,
            required: true
        },
        password: String,
        firstName: String,
        lastName: String,
        profilePhoto: {
            type: String,
            default: "https://images.unsplash.com/photo-1572288623190-5bb8b0d81aa2?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=500&q=60"
        },
        email: {
            type: String,
            unique: true,
            required: true
        },
        shareEmail: {
            type: Boolean,
            default: false
        },
        facebook: String,
        youtube: String,
        twitter: String,
        linkedIn: String,
        resetPasswordToken: String,
        resetPasswordExpires: Date,
        isAdmin: {
            type: Boolean,
            default: false
        },
        notifications: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Notification"
        }],
        followers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        favorites:[{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campground"
        }]
    }, {
        timestamps: true
    });

UserSchema.plugin(pasportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);