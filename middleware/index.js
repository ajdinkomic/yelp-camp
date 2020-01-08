var Campground = require("../models/campground");
var Comment = require("../models/comment");
var Review = require("../models/review");
var middlewareObj = {};

middlewareObj.checkCampgroundOwnership = function (req, res, next) {
    // is user logged in?
    if (req.isAuthenticated()) {
        Campground.findOne({slug: req.params.slug}, function (err, foundCampground) {
            if (err || !foundCampground) { // error or foundcampground is null
                req.flash("error", "Campground not found!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                res.redirect("back");
            } else {
                // does user own campground?
                // console.log(foundCampground.author.id); // this is object (mongoose object)
                // console.log(req.user._id); // this is String,so we can't use === but .equals
                if (foundCampground.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next();
                } else {
                    req.flash("error", "You don't have permission!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
        res.redirect("back")
    }
};

middlewareObj.checkCommentOwnership = function (req, res, next) {
    // is user logged in?
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, function (err, foundComment) {
            if (err || !foundComment) {
                req.flash("error", "Comment not found!");
                res.redirect("back");
            } else {
                // does user own campground?
                // console.log(foundComment.author.id); // this is object (mongoose object)
                // console.log(req.user._id); // this is String,so we can't use === but .equals
                if (foundComment.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next();
                } else {
                    req.flash("error", "You don't have permission!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
        res.redirect("back")
    }
};

middlewareObj.checkReviewOwnership = function (req, res, next) {
    if (req.isAuthenticated()) {
        Review.findById(req.params.review_id, function (err, foundReview) {
            if (err || !foundReview) {
                req.flash("error", "Review not found!");
                res.redirect("back");
            } else {
                if (foundReview.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next();
                } else {
                    req.flash("error", "You don't have permission!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
        res.redirect("back")
    }
};

middlewareObj.checkReviewExistence = function (req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findOne({slug: req.params.slug}).populate("reviews").exec(function (err, foundCampground) {
            if (err || !foundCampground) {
                req.flash("error", "Campground not found!");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundCampground.reviews
                var foundUserReview = foundCampground.reviews.some(function (review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    res.redirect("back");
                }
                next();
            }
        });
    } else {
        req.flash("error", "You need to be logged in!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
        res.redirect("back")
    }
};

middlewareObj.isLoggedIn = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error", "You need to be logged in!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
    res.redirect("/login");
};


module.exports = middlewareObj;