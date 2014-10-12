var fs = require('fs');
var Recaptcha = require('recaptcha').Recaptcha;
var Database = require('../src/Database');

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
			songs: files,
			scClientId: process.env.DANSA_SC_CLIENT_ID
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
		backgroundUrl: backgroundUrl,
		scClientId: process.env.DANSA_SC_CLIENT_ID
	};

	if(scSong){
		opts.soundCloudSong = scSong;
	}

	res.render('play', opts);
};

/**
 * GET /songs/:id/play
 */
exports.playSong = function(req, res, next){
	var id = parseInt(req.params.id, 10);

	if(isNaN(id)){
		return res.status(400).render('404', {
			message: 'Script usage error.'
		});
	}

	Database.query("SELECT * FROM dansa_songs WHERE id=$1", [id], function (err, result){
		if(err) return next(err);

		if(!result.rows.length){
			return res.status(404).render('404', {
				message: 'The song could not be found.'
			});
		}

		res.render('play', {
			song: result.rows[0],
			scClientId: process.env.DANSA_SC_CLIENT_ID
		});
	});
};

/**
 * GET /setup
 */
exports.setup = function(req, res, next){
	res.render('setup');
};

/**
 * GET /save
 */
exports.save = function(req, res, next){
	var body = req.body;

	var recaptcha = new Recaptcha(process.env.DANSA_RECAPTCHA_PUBLIC_KEY, process.env.DANSA_RECAPTCHA_PRIVATE_KEY, {
		remoteip:  req.connection.remoteAddress,
		challenge: req.body.recaptcha_challenge_field,
		response:  req.body.recaptcha_response_field
	});

	recaptcha.verify(function (captchaSuccess, error_code){
		if(!captchaSuccess){
			return res.render('play', {
				song: body,
				scClientId: process.env.DANSA_SC_CLIENT_ID
			});
		}

		// Insert new song
		var sql = "INSERT INTO dansa_songs (notes,bpm,posoffset,scid) VALUES($1,$2,$3,$4) RETURNING id";
		Database.query(sql, [body.notes, body.bpm, body.posoffset, body.scid], function (err, result){
			if(err) return next(err);

			// Redirect to the new song!
			res.redirect('/songs/' + result.rows[0].id + '/play');
		});
	});
};