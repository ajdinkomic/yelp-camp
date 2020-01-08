var express = require("express"),
    router = express.Router({
        mergeParams: true
    }), // params from campgrounds and comments together so we can find id of campground
    Campground = require("../models/campground"),
    Comment = require("../models/comment"),
    middleware = require("../middleware"); // if we require folder it requires automatically file named index.js 

//================================================
//          COMMENTS ROUTES
//================================================

// show new comment form
router.get("/new", middleware.isLoggedIn, function (req, res) {
    Campground.findById(req.params.id, function (err, campground) {
        if (err || !campground) {
            req.flash("error", "Campground not found!");
            res.redirect("/campgrounds");
        } else {
            res.render("comments/new", {
                campground: campground
            });
        }
    })
});

// add new comment
router.post("/", middleware.isLoggedIn, function (req, res) {
    Campground.findById(req.params.id, function (err, campground) {
        if (err || !campground) {
            req.flash("error", "Campground not found!");
            return res.redirect("/campgrounds");
        } else {
            Comment.create(req.body.comment, function (err, comment) {
                if (err) {
                    req.flash("error", "Something went wrong!");
                    res.redirect("/campgrounds");
                } else {
                    // add username and id to comment
                    // we only get here if user is logged in so we can use req.user
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    //save comment
                    comment.save();
                    campground.comments.push(comment);
                    campground.save();
                    req.flash("success", "Successfully added comment!")
                    res.redirect('/campgrounds/' + campground._id);
                }
            });
        }
    })
});

// show edit form for a comment -> edit route
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function (req, res) {
    Campground.findById(req.params.id, function (err, foundCampground) {
        if (err || !foundCampground) {
            req.flash("error", "Campground not found!");
            return res.redirect("back");
        }
        Comment.findById(req.params.comment_id, function (err, foundComment) {
            if (err || !foundComment) {
                req.flash("error", "Comment not found!");
                res.redirect("back");
            } else {
                res.render("comments/edit", {
                    campground_id: req.params.id,
                    comment: foundComment
                });
            }
        });
    });
});

// update comment -> update route
router.put("/:comment_id", middleware.checkCommentOwnership, function (req, res) {
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function (err, updatedComment) {
        if (err || !updatedComment) {
            req.flash("error", "Comment not found!");
            res.redirect("/campgrounds");
        } else {
            res.redirect("/campgrounds/" + req.params.id);
        }
    });
});

// destroy route
router.delete("/:comment_id", middleware.checkCommentOwnership, function (req, res) {
    Comment.findByIdAndRemove(req.params.comment_id, function (err, commentRemoved) {
        if (err || !commentRemoved) {
            req.flash("error", "Comment not found!");
            res.redirect("/campgrounds");
        } else {
            req.flash("success", "Comment deleted");
            res.redirect("/campgrounds/" + req.params.id)
        }
    })
});

module.exports = router;