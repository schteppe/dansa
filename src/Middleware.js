var Database = require('./Database');

module.exports = Middleware;

function Middleware(){}

Middleware.getSong = function(options){

	return function(req, res, next){
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

			req.song = result.rows[0];

			next();
		});
	};
};