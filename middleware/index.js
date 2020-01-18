const Campground = require("../models/campground"),
    Review = require("../models/review");

module.exports = {
    isLoggedIn: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash("error", "You need to be logged in!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
        res.redirect("/login");
    },

    checkCampgroundOwnership: (req, res, next) => {
        Campground.findOne({
            slug: req.params.slug
        }, (err, foundCampground) => {
            if (err || !foundCampground) { // error or foundcampground is null
                req.flash("error", "Campground not found!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                res.redirect("/campgrounds");
            } else if (foundCampground.author.id.equals(req.user._id) || req.user.isAdmin) {
                // does user own campground?
                // console.log(foundCampground.author.id); // this is object (mongoose object)
                // console.log(req.user._id); // this is String,so we can't use === but .equals
                req.campground = foundCampground;
                next();
            } else {
                req.flash("error", "You don't have permission!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                res.redirect(`/campgrounds/${req.params.slug}`);
            }
        });
    },

    checkReviewOwnership: (req, res, next) => {
        Review.findById(req.params.review_id, (err, foundReview) => {
            if (err || !foundReview) {
                req.flash("error", "Review not found!");
                res.redirect("back");
            } else {
                if (foundReview.author.id.equals(req.user._id) || req.user.isAdmin) {
                    req.review = foundReview;
                    next();
                } else {
                    req.flash("error", "You don't have permission!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    res.redirect("back");
                }
            }
        });
    },

    checkReviewExistence: (req, res, next) => {
        Campground.findOne({
            slug: req.params.slug
        }).populate("reviews").exec((err, foundCampground) => {
            if (err || !foundCampground) {
                req.flash("error", "Campground not found!");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundCampground.reviews
                const foundUserReview = foundCampground.reviews.some(review => review.author.id.equals(req.user._id));
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    return res.redirect(`/campgrounds/${foundCampground.slug}`);
                }
                if(foundCampground.author.id.equals(req.user._id)){
                    req.flash("error", "You own this campground!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    return res.redirect(`/campgrounds/${foundCampground.slug}`);
                }
                req.campground = foundCampground;
                next();
            }
        });
    }

}