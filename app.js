var dotenv = require("dotenv");
dotenv.config();

var express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    flash = require("connect-flash"),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    methodOverride = require("method-override"),
    User = require("./models/user");
// var seedDB = require("./seeds");

// Require routes
var campgroundRoutes = require("./routes/campgrounds"),
    reviewRoutes = require("./routes/reviews"),
    indexRoutes = require("./routes/index"); // auth routes

// FLASH MESSAGES - should come before passport
app.use(flash());

// MOMENT JS
app.locals.moment = require("moment");

// PASSPORT CONFIG
app.use(require("express-session")({
    secret: "Rusty is the best.",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// make our req.user or currentUser accessible on all routes and views
app.use(async function (req, res, next) {
    res.locals.currentUser = req.user;
    if (req.user) {
        try {
            let user = await User.findById(req.user._id).populate("notifications", null, {
                isRead: false
            }, null, {
                sort: {
                    "_id": -1
                }
            }).exec();
            res.locals.notifications = user.notifications;
        } catch (err) {
            console.log(err.message);
        }
    }
    res.locals.errorMessage = req.flash("error");
    res.locals.successMessage = req.flash("success");
    next(); // IMPORTANT!!! it will stop without this
});

// connect to mongodb 
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("useUnifiedTopology", true);
var url = process.env.DATABASEURL || "mongodb://localhost:27017/yelp_camp_v100";
mongoose.connect(url);

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
// seedDB(); //seed the db

app.use("/", indexRoutes);
app.use("/campgrounds/:slug/reviews", reviewRoutes);
app.use("/campgrounds", campgroundRoutes);

var port = process.env.PORT;
var ip = process.env.IP;
app.listen(port, ip, function () {
    console.log("YelpCamp Server Started!");
});