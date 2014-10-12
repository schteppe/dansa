var fs = require('fs');
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