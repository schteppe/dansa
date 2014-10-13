var fs = require('fs');
var Recaptcha = require('recaptcha').Recaptcha;
var Database = require('../src/Database');
var validate = require('jsonschema').validate;

/**
 * GET /setup
 */
exports.setup = function(req, res, next){
	res.render('setup');
};

/**
 * GET /
 * Choose song or whatever
 */
exports.index = function(req, res, next){
	fs.readdir('public/songs', function (err, files){
		if(err) return next(err);

		files = files.filter(function (f){
			return !isNaN(parseInt(f, 10));
		}).map(function (f){
			return parseInt(f, 10);
		});

		files.sort(function (a, b){
			return a - b;
		});

		res.render('index', {
			songs: files
		});
	});
};

/**
 * GET /play
 */
exports.play = function(req, res, next){
	var songId = parseInt(req.query.songId, 10);
	var scSong = req.query.scSong;
	var backgroundUrl = req.query.bg || false;

	var opts = {
		songId: songId,
		backgroundUrl: backgroundUrl
	};

	if(scSong){
		opts.soundCloudSong = scSong;
	}

	res.render('play', opts);
};

/**
 * GET /songs/:id
 */
exports.viewSong = function(req, res, next){
	res.render('song', {
		song: req.song,
		success: req.query.created ? ['Created song! Go ahead and share it :)'] : []
	});
};

/**
 * GET /songs/:id/play
 */
exports.playSong = function(req, res, next){
	res.render('play', {
		song: req.song
	});
};

/**
 * GET /songs/new
 */
exports.newSong = function(req, res, next){
	res.render('play', {
		song: {
			bpm: 100,
			posoffset: 0,
			notes: JSON.stringify(
				[
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"],
					["1000","0100","0010","0001"]
				]
			),
			scid: 0
		},
		edit: true
	});
};

/**
 * GET /songs/:id/edit
 */
exports.editSong = function(req, res, next){
	res.render('play', {
		song: req.song,
		edit: true
	});
};


/**
 * POST /songs/:id/edit
 */
exports.save = function(req, res, next){
	var body = req.body;

	var recaptcha = new Recaptcha(process.env.DANSA_RECAPTCHA_PUBLIC_KEY, process.env.DANSA_RECAPTCHA_PRIVATE_KEY, {
		remoteip:  req.connection.remoteAddress,
		challenge: req.body.recaptcha_challenge_field,
		response:  req.body.recaptcha_response_field
	});

	recaptcha.verify(function (captchaSuccess, error_code){
		var errors = [];

		if(!captchaSuccess){
			errors.push('The captcha was incorrect. Try again.');
		}

		var parsedNotes = JSON.parse(body.notes);

		// Validate
		var result = validate(parsedNotes, {
			type: "array",
			items: {
				type: "array",
				minItems: 1,
				maxItems: 1000,
				items: {
					type: 'string',
					pattern: /^[0-3ML]{4}$/
				}
			},
			minItems: 1,
			maxItems: 1000
		});
		if(result.errors.length){
			errors.push('The note data does not validate: ' + result.errors.join(', '));
		}

		if(errors.length){
			return res.render('play', {
				song: body,
				edit: true,
				errors: errors
			});
		}

		// Insert new song
		var sql = "INSERT INTO dansa_songs (notes,bpm,posoffset,scid) VALUES($1,$2,$3,$4) RETURNING id";
		Database.query(sql, [body.notes, body.bpm, body.posoffset, body.scid], function (err, result){
			if(err) return next(err);

			// Redirect to the new song!
			res.redirect('/songs/' + result.rows[0].id + '?created=1');
		});
	});
};

exports.listSongs = function(req, res, next){
	var sql = "SELECT * FROM dansa_songs OFFSET 0 LIMIT 200";
	Database.query(sql, [], function (err, result){
		if(err) return next(err);

		res.render('songs', {
			songs: result
		});
	});
};