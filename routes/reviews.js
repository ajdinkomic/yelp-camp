var express = require("express"),
  router = express.Router({
    mergeParams: true
  }),
  Campground = require("../models/campground"),
  Review = require("../models/review"),
  middleware = require("../middleware");

// Reviews index
router.get("/", function (req, res) {
  Campground.findOne({slug: req.params.slug}).populate({
    path: "reviews",
    options: {
      sort: {
        createdAt: -1
      }
    }
  }).exec(function (err, campground) {
    if (err || !campground) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("reviews/index", {
      campground: campground
    });
  });
});

// Reviews new
router.get("/new", middleware.isLoggedIn, middleware.checkReviewExistence, function (req, res) {
  // middleware.checkReviewExistence checks if a user already reviewed the campground, only one review per user is allowed
  Campground.findOne({slug: req.params.slug}, function (err, campground) {
    if (err || !campground) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("reviews/new", {
      campground: campground
    });
  });
});

// Reviews create
router.post("/", middleware.isLoggedIn, middleware.checkReviewExistence, function (req, res) {
  Campground.findOne({slug: req.params.slug}).populate("reviews").exec(function (err, campground) {
    if (err || !campground) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    Review.create(req.body.review, function (err, review) {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      review.author.id = req.user._id;
      review.author.username = req.user.username;
      review.campground = campground;
      review.save();
      campground.reviews.push(review);

      campground.rating = calculateAvg(campground.reviews);
      campground.save();
      req.flash("success", "Your review has been successfully added.");
      res.redirect("/campgrounds/" + campground.slug);
    });
  });
});

// Reviews edit
router.get("/:review_id/edit", middleware.checkReviewOwnership, function (req, res) {
  Review.findById(req.params.review_id, function (err, review) {
    if (err || !review) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("reviews/edit", {
      campground_slug: req.params.slug,
      review: review
    });
  });
});

// Reviews update
router.put("/:review_id", middleware.checkReviewOwnership, function (req, res) {
  Review.findByIdAndUpdate(req.params.review_id, req.body.review, {
    new: true
  }, function (err, review) {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    Campground.findOne({slug: req.params.slug}).populate("reviews").exec(function (err, campground) {
      if (err || !campground) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      campground.rating = calculateAvg(campground.reviews);
      campground.save();
      req.flash("success", "Your review was successfully edited.");
      res.redirect("/campgrounds/" + campground.slug);
    });
  });
});

// Reviews delete
router.delete("/:review_id", middleware.checkReviewOwnership, function (req, res) {
  Review.findByIdAndDelete(req.params.review_id, function (err) {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    Campground.findOneAndUpdate({slug: req.params.slug}, {$pull: {reviews: req.params.review_id}}, {new:true}).populate("reviews").exec(function (err, campground) {
      if (err || !campground) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      campground.rating = calculateAvg(campground.reviews);
      campground.save();
      req.flash("success", "Your review was successfully deleted.");
      res.redirect("/campgrounds/" + req.params.slug);
    });
  });
});

function calculateAvg(reviews) {
  if (reviews.length === 0) {
    return 0;
  }
  var sum = 0;
  reviews.forEach(function (element) {
    sum += element.rating;
  });
  return sum / reviews.length;
}

module.exports = router;