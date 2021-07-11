const express = require('express'),
	router = express.Router(),
	Campground = require('../models/campground'),
	User = require('../models/user'),
	Notification = require('../models/notification'),
	multer = require('multer'),
	cloudinary = require('cloudinary').v2,
	nodeGeocoder = require('node-geocoder');

const { isLoggedIn, checkCampgroundOwnership } = require('../middleware'); // if we require folder it requires automatically file named index.js

// multer config
const storage = multer.diskStorage({
	filename: (req, file, callback) => {
		callback(null, Date.now() + file.originalname);
	}
});
const imageFilter = (req, file, cb) => {
	// only accept images
	if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
		return cb(new Error('Only image files are allowed!'), false);
	}
	cb(null, true);
};
const upload = multer({
	storage: storage,
	fileFilter: imageFilter
});

// cloudinary config
cloudinary.config({
	cloud_name: 'ajdinkomiccloud',
	api_key: process.env.CLOUDINARY_API,
	api_secret: process.env.CLOUDINARY_SECRET
});

// google maps geocoder config
const options = {
		provider: 'google',
		httpAdapter: 'https',
		apiKey: process.env.GEOCODER_API,
		formatter: null
	},
	geocoder = nodeGeocoder(options);

// INDEX - show all campgrounds
router.get('/', (req, res) => {
	const perPage = 6;
	const pageQuery = parseInt(req.query.page);
	const pageNumber = pageQuery ? pageQuery : 1;
	if (req.query.search) {
		// make a new regexp
		const regexp = new RegExp(escapeRegexp(req.query.search), 'gi'); // 'gi' are flags, g-global, i-ignore case(uppercase and lowercase)
		// get all campgrounds from db whose name matches search input
		Campground.find({
			name: regexp
		})
			.sort({
				createdAt: -1
			})
			.skip(perPage * pageNumber - perPage)
			.limit(perPage)
			.exec((err, allCampgrounds) => {
				Campground.countDocuments({
					name: regexp
				}).exec((err, count) => {
					if (err) {
						req.flash('error', 'Campgrounds could not be retrieved from DB!');
						return res.redirect('back');
					} else {
						res.render('campgrounds/index', {
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
		Campground.find({})
			.sort({
				createdAt: -1
			})
			.skip(perPage * pageNumber - perPage)
			.limit(perPage)
			.exec((err, allCampgrounds) => {
				Campground.countDocuments().exec((err, count) => {
					if (err) {
						req.flash('error', 'Campgrounds not Found!');
						return res.redirect('back');
					} else {
						res.render('campgrounds/index', {
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
router.post('/', isLoggedIn, upload.single('image'), async (req, res) => {
	try {
		// let data = await geocoder.geocode(req.body.location);
		// if (!data || data.length === 0) {
		//     throw new Error("Invalid address!");
		// } else {

		let result = await cloudinary.uploader.upload(req.file.path);

		// get data from form and add to campgrounds array
		const name = req.body.name,
			image = result.secure_url,
			imageId = result.public_id,
			desc = req.body.description,
			price = req.body.price,
			author = {
				id: req.user._id,
				username: req.user.username
			},
			lat = 37.8651011,
			lng = -119.5383294,
			location = 'Yosemite National Park, California, USA',
			newCampground = {
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

		let campground = await Campground.create(newCampground);
		let user = await User.findById(req.user._id).populate('followers').exec();
		let newNotification = {
			username: req.user.username,
			campgroundSlug: campground.slug
		};
		for (const follower of user.followers) {
			let notification = await Notification.create(newNotification);
			follower.notifications.push(notification);
			follower.save();
		}
		req.flash('success', 'Thank you for submitting your campground!');
		res.redirect(`/campgrounds/${campground.slug}`);
		// }
	} catch (err) {
		req.flash('error', err.message);
		return res.redirect('back');
	}
});

// NEW - show form to create new campground
router.get('/new', isLoggedIn, (req, res) => {
	res.render('campgrounds/new');
});

// this has to be declared last because it is /campgrounds/anything, so it could be /campgrounds/new and we don't want that
// SHOW - info about one specific campground
router.get('/:slug', (req, res) => {
	//find campground with provided slug
	Campground.findOne({
		slug: req.params.slug
	})
		.populate({
			path: 'reviews',
			options: {
				sort: {
					createdAt: -1
				}
			}
		})
		.exec((err, foundCampground) => {
			if (err || !foundCampground) {
				req.flash('error', 'Campground not found!');
				res.redirect('/campgrounds');
			} else {
				//render show template with that campground
				res.render('campgrounds/show', {
					campground: foundCampground
				});
			}
		});
});

// EDIT CAMPGROUND ROUTE
router.get('/:slug/edit', isLoggedIn, checkCampgroundOwnership, (req, res) => {
	res.render('campgrounds/edit', {
		campground: req.campground
	});
});

// UPDATE CAMPGROUND ROUTE
router.put('/:slug', isLoggedIn, checkCampgroundOwnership, upload.single('image'), async (req, res) => {
	delete req.body.campground.rating;
	let campground = req.campground; // campground returned from checkCampgroundOwnership in middleware/index

	if (req.file) {
		try {
			await cloudinary.uploader.destroy(campground.imageId);
			let result = await cloudinary.uploader.upload(req.file.path);
			campground.image = result.secure_url;
		} catch (err) {
			req.flash('error', err.message);
			return res.redirect('back');
		}
	}
	if (req.body.campground.location) {
		try {
			let data = await geocoder.geocode(req.body.campground.location);
			campground.lat = data[0].latitude;
			campground.lng = data[0].longitude;
			campground.location = data[0].formattedAddress;
		} catch (err) {
			req.flash('error', 'Invalid address');
			return res.redirect('back');
		}
	}
	campground.name = req.body.campground.name;
	campground.price = req.body.campground.price;
	campground.description = req.body.campground.description;
	campground.save(err => {
		if (err) {
			req.flash('error', 'Campground could not be updated!');
			res.redirect('/campgrounds');
		} else {
			req.flash('success', 'Campground successfully updated!');
			res.redirect(`/campgrounds/${campground.slug}`);
		}
	});
});

// ADD CAMPGROUND TO FAVORITES ROUTE
router.get('/favorites/:slug', isLoggedIn, async (req, res) => {
	try {
		let campground = await Campground.findOne({
			slug: req.params.slug
		});
		req.user.favorites.push(campground._id);
		req.user.save();
		req.flash('success', `${campground.name} added to favorites!`);
		res.redirect('/campgrounds');
	} catch (err) {
		req.flash('error', 'Campground could not be added to favorites!');
		res.redirect('back');
	}
});

// DESTROY CAMPGROUND ROUTE
router.delete('/:slug', isLoggedIn, checkCampgroundOwnership, async (req, res) => {
	let campground = req.campground; // campground returned from checkCampgroundOwnership in middleware/index

	try {
		await campground.deleteOne();
	} catch (err) {
		req.flash('error', 'Campground could not be removed!');
		return res.redirect('back');
	}
	req.flash('success', 'Campground succesfully removed!');
	res.redirect('/campgrounds');
});

// function for escaping regular expressions in search input, /g is to replace all ocurrences of special characters (globally)
let escapeRegexp = text => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

module.exports = router;
