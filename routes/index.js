var express = require("express"),
    router = express.Router(),
    passport = require("passport"),
    User = require("../models/user"),
    Campground = require("../models/campground"),
    Notification = require("../models/notification"),
    Review = require("../models/review"),
    async = require("async"),
        nodemailer = require("nodemailer"),
        crypto = require("crypto"),
        middleware = require("../middleware");

// LANDING PAGE
router.get("/", function (req, res) {
    res.render("landing");
});

//================================================
//          AUTH ROUTES
//================================================

// show register form
router.get("/register", function (req, res) {
    res.render("register", {
        page: "register"
    });
});

//handle sign up logic
router.post("/register", function (req, res) {
    let profilePhoto = null;
    if (req.body.profilePhoto) {
        profilePhoto = req.body.profilePhoto;
    } else {
        profilePhoto = "https://images.unsplash.com/photo-1455763916899-e8b50eca9967?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=500&q=60";
    }
    var newUser = new User({
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        profilePhoto: profilePhoto,
        email: req.body.email,
        facebook: req.body.facebook,
        youtube: req.body.youtube,
        twitter: req.body.twitter,
        linkedIn: req.body.linkedIn
    });
    if (req.body.adminCode === process.env.ADMINCODE) {
        newUser.isAdmin = true;
    }
    if (req.body.shareEmail === "share") {
        newUser.shareEmail = true;
    }
    User.register(newUser, req.body.password, function (err, user) {
        if (err) {
            return res.render("register", {
                errorMessage: err.message
            });
        }
        passport.authenticate("local")(req, res, function () {
            req.flash("success", "Successfully Signed Up! Nice to meet you " + user.username + ".");
            res.redirect("/campgrounds");
        });
    });
});

// show login form
router.get("/login", function (req, res) {
    res.render("login", {
        page: "login"
    });
});

// handling login logic
router.post("/login", passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login",
    failureFlash: true,
    successFlash: "Welcome back."
}), function (req, res) {});


// logout
router.get("/logout", function (req, res) {
    req.logout();
    req.flash("success", "See you later!");
    res.redirect("/campgrounds");
});

// user profile
router.get("/users/:username", async function (req, res) {
    try {
        let user = await User.findOne({
            username: req.params.username
        });
        let campgrounds = await Campground.find({
            "author.id": user._id
        });
        let reviews = await Review.find({
            "author.id": user._id
        });
        res.render("users/show", {
            user,
            campgrounds,
            reviews
        })
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("back");
    }
});

// follow user
router.get("/follow/:username", middleware.isLoggedIn, async function (req, res) {
    try {
        let user = await User.findOne({
            username: req.params.username
        });
        user.followers.push(req.user._id);
        user.save();
        req.flash("success", "Successfully followed " + user.username);
        res.redirect("/users/" + req.params.username);
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("back");
    }
});

// view all notifications
router.get("/notifications", middleware.isLoggedIn, async function (req, res) {
    try {
        let user = await User.findById(req.user._id).populate({
            path: "notifications",
            options: {
                sort: {
                    "_id": -1
                }
            }
        }).exec();
        let allNotifications = user.notifications;
        let notifications = [];
        let allUnreadNotifications = [];
        allNotifications.forEach(function (notification) {
            if (!notification.isRead) {
                allUnreadNotifications.push(notification);
            } else {
                notifications.push(notification);
            }
        })
        res.render("notifications/index", {
            notifications: notifications,
            unreadNotifications: allUnreadNotifications
        });
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("back");
    }
});

// handle notification
router.get("/notifications/:id", middleware.isLoggedIn, async function (req, res) {
    try {
        let notification = await Notification.findById(req.params.id);
        notification.isRead = true;
        notification.save();
        res.redirect("/campgrounds/" + notification.campgroundSlug);
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("back");
    }
});

// forgot password
router.get("/forgot", function (req, res) {
    res.render("forgot");
});

router.post("/forgot", function (req, res, next) {
    async.waterfall([
        function (done) {
            crypto.randomBytes(20, function (err, buf) {
                var token = buf.toString("hex");
                done(err, token);
            });
        },
        function (token, done) {
            User.findOne({
                email: req.body.email
            }, function (err, user) {
                if (err || !user) {
                    req.flash("error", "No account with that email address found.");
                    return res.redirect("/forgot");
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
        },
        function (token, user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "ajdin.komic12@gmail.com",
                    pass: process.env.MAILPW
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            var mailOptions = {
                to: user.email,
                from: "ajdin.komic12@gmail.com",
                subject: "YelpCamp Password Reset Request",
                text: "Dear " + user.firstName + ",\n\n" + "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
                    "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
                    "http://" + req.headers.host + "/reset/" + token + "\n\n" +
                    "If you did not request this, please ignore this email and your password will remain unchanged.\n"
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                req.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
                done(err, "done");
            });
        }
    ], function (err) {
        if (err) return next(err);
        res.redirect("/forgot");
    });
});

router.get("/reset/:token", function (req, res) {
    // $gt means greater than
    User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function (err, user) {
        if (err || !user) {
            req.flash("error", "Password reset token is invalid or has expired.");
            return res.redirect("/forgot");
        }
        res.render("reset", {
            token: req.params.token
        });
    });
});

router.post("/reset/:token", function (req, res) {
    async.waterfall([
        function (done) {
            User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: {
                    $gt: Date.now()
                }
            }, function (err, user) {
                if (err || !user) {
                    req.flash("error", "Password reset token is invalid or has expired.");
                    return res.redirect("/forgot");
                }
                if (req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function (err) {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;

                        user.save(function (err) {
                            if (err) {
                                req.flash("error", "User could not be saved to DB!");
                                return res.redirect("back");
                            }
                            req.logIn(user, function (err) {
                                done(err, user);
                            });
                        });
                    });
                } else {
                    req.flash("error", "Passwords do not match!");
                    return res.redirect("back");
                }
            });
        },
        function (user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "ajdin.komic12@gmail.com",
                    pass: process.env.MAILPW
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            var mailOptions = {
                to: user.email,
                from: "ajdin.komic12@gmail.com",
                subject: "Your YelpCamp Password Has Been Changed",
                text: "Hello, " + user.firstName + "\n\n" +
                    "This is a confirmation that the password for your account " + user.email + " has just been changed.\n"
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                req.flash("success", "Your password has been successfully changed.");
                done(err);
            });
        }
    ], function (err) {
        if (err) {
            req.flash("error", "Something went wrong!");
            return res.redirect("back");
        }
        res.redirect("/campgrounds");
    });
});

module.exports = router;