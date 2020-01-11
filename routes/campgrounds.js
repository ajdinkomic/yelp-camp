var express = require("express"),
    router = express.Router(),
    Campground = require("../models/campground"),
    User = require("../models/user"),
    Notification = require("../models/notification"),
    multer = require("multer"),
    cloudinary = require("cloudinary").v2,
    middleware = require("../middleware"); // if we require folder it requires automatically file named index.js 

// multer config
var storage = multer.diskStorage({
    filename: function (req, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});
var imageFilter = function (req, file, cb) {
    // only accept images
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
}
var upload = multer({
    storage: storage,
    fileFilter: imageFilter
});

// cloudinary config
cloudinary.config({
    cloud_name: "ajdinkomiccloud",
    api_key: process.env.CLOUDINARY_API,
    api_secret: process.env.CLOUDINARY_SECRET
});

// google maps geocoder config
var nodeGeocoder = require('node-geocoder');
var options = {
    provider: 'google',
    httpAdapter: 'https',
    apiKey: process.env.GEOCODER_API,
    formatter: null
};
var geocoder = nodeGeocoder(options);

// INDEX - show all campgrounds
router.get("/", function (req, res) {
    var perPage = 6;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    if (req.query.search) {
        // make a new regexp
        var regexp = new RegExp(escapeRegexp(req.query.search), 'gi'); // 'gi' are flags, g-global, i-ignore case(uppercase and lowercase)
        // get all campgrounds from db whose name matches search input
        Campground.find({
            name: regexp
        }).sort({
            createdAt: -1
        }).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.countDocuments({
                name: regexp
            }).exec(function (err, count) {
                if (err) {
                    req.flash("error", "Campgrounds could not be retrieved from DB!");
                    return res.redirect("back");
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        search: req.query.search
                    });
                }
            });
        });
    } else {
        // get all campgrounds from db
        Campground.find({}).sort({
            createdAt: -1
        }).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.countDocuments().exec(function (err, count) {
                if (err) {
                    req.flash("error", "Campgrounds not Found!");
                    return res.redirect("back");
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        search: false
                    });
                }
            });
        });
    }
});

// CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single("image"), function (req, res) {
    cloudinary.uploader.upload(req.file.path, function (err, result) {
        // get data from form and add to campgrounds array
        var name = req.body.name;
        var image = result.secure_url;
        var imageId = result.public_id;
        var desc = req.body.description;
        var price = req.body.price;
        var author = {
            id: req.user._id,
            username: req.user.username
        }
        geocoder.geocode(req.body.location, async function (err, data) {
            if (err || !data.length) {
                req.flash("error", "Invalid address");
                return res.redirect("back");
            }
            var lat = data[0].latitude;
            var lng = data[0].longitude;
            var location = data[0].formattedAddress;
            var newCampground = {
                name: name,
                price: price,
                image: image,
                imageId: imageId,
                description: desc,
                author: author,
                location: location,
                lat: lat,
                lng: lng
            };
            // Create a new campground and save to DB
            try {
                let campground = await Campground.create(newCampground);
                let user = await User.findById(req.user._id).populate("followers").exec();
                let newNotification = {
                    username: req.user.username,
                    campgroundSlug: campground.slug
                }
                for (const follower of user.followers) {
                    let notification = await Notification.create(newNotification);
                    follower.notifications.push(notification);
                    follower.save();
                }
                res.redirect("/campgrounds");
            } catch (err) {
                req.flash("error", err.message);
                return res.redirect('back');
            }
        });
    });
});

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function (req, res) {
    res.render("campgrounds/new");
});

// this has to be declared last because it is /campgrounds/anything, so it could be /campgrounds/new and we don't want that
// SHOW - info about one specific campground
router.get("/:slug", function (req, res) {
    //find campground with provided slug
    Campground.findOne({
        slug: req.params.slug
    }).populate({
        path: "reviews",
        options: {
            sort: {
                createdAt: -1
            }
        }
    }).exec(function (err, foundCampground) {
        if (err || !foundCampground) {
            req.flash("error", "Campground not found!");
            res.redirect("/campgrounds");
        } else {
            //render show template with that campground
            res.render("campgrounds/show", {
                campground: foundCampground
            });
        }
    });
});

// EDIT CAMPGROUND ROUTE
router.get("/:slug/edit", middleware.checkCampgroundOwnership, function (req, res) {
    Campground.findOne({
        slug: req.params.slug
    }, function (err, foundCampground) {
        if (err || !foundCampground) {
            req.flash("error", "Campground not found!");
            return res.redirect("back");
        }
        res.render("campgrounds/edit", {
            campground: foundCampground
        });
    });
});

// UPDATE CAMPGROUND ROUTE
router.put("/:slug", middleware.checkCampgroundOwnership, upload.single("image"), function (req, res) {
    delete req.body.campground.rating;
    Campground.findOne({
        slug: req.params.slug
    }, async function (err, campground) {
        if (err || !campground) {
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.file) {
                try {
                    await cloudinary.uploader.destroy(campground.imageId);
                    var result = await cloudinary.uploader.upload(req.file.path);
                    campground.image = result.secure_url;
                } catch (err) {
                    req.flash("error", err.message);
                    return res.redirect('back');
                }
            }
            if (req.body.campground.location) {
                try {
                    var data = await geocoder.geocode(req.body.campground.location);
                    campground.lat = data[0].latitude;
                    campground.lng = data[0].longitude;
                    campground.location = data[0].formattedAddress;
                } catch (err) {
                    req.flash("error", err.message);
                    return res.redirect('back');
                }
            }
            campground.name = req.body.campground.name;
            campground.price = req.body.campground.price;
            campground.description = req.body.campground.description;
            campground.save(function (err) {
                if (err) {
                    req.flash("error", "Campground could not be updated!");
                    res.redirect("/campgrounds");
                } else {
                    req.flash("success", "Campground successfully updated!");
                    res.redirect("/campgrounds/" + campground.slug);
                }
            });

        }
    });
});

// DESTROY CAMPGROUND ROUTE
router.delete("/:slug", middleware.checkCampgroundOwnership, function (req, res) {
    Campground.findOne({
        slug: req.params.slug
    }, async function (err, campground) {
        if (err || !campground) {
            req.flash("error", "Campground not found!");
            res.redirect("/campgrounds");
        } else {
            try {
                await campground.deleteOne();
            } catch (err) {
                req.flash("error", "Campground could not be removed!");
                return res.redirect("back");
            }
            req.flash("success", "Campground succesfully removed!");
            res.redirect("/campgrounds");
        }
    });
});

// function for escaping regular expressions in search input, /g is to replace all ocurrences of special characters (globally)
function escapeRegexp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;