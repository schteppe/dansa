var fs = require('fs');
var pg = require('pg');
var path = require('path');

module.exports = new Database();

function Database(){

}

Database.prototype.query = function(query, values, callback){
	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
		if(err) return callback(err);

		client.query(query, values, function (err, result) {
			done();
			callback(err, result);
		});
	});
};

Database.prototype.sync = function(options, callback){
	options = options || {};

	var that = this;

	fs.readFile(path.join(__dirname, '..', 'init.sql'), {
		encoding: 'utf8'
	}, function (err, data) {
		if (err) return callback(err);

		var matches = data.match(/CREATE TABLE IF NOT EXISTS dansa_([a-zA-Z0-9_]+)/g);
		var pre = '';
		if(matches.length && process.env.DANSA_DB_FORCE_CREATE){
			while (matches.length) {
				var table = matches.pop().replace('CREATE TABLE IF NOT EXISTS ','');
				pre += 'DROP TABLE IF EXISTS ' + table + ';\n';
			}
		}

		if(options.force || process.env.DANSA_DB_FORCE_CREATE){
			data = data.replace(/IF NOT EXISTS /g, '');
		}

		if(process.env.DANSA_TABLE_PREFIX){
			data = data.replace(/dansa_/g, process.env.DANSA_TABLE_PREFIX);
		}

		data = pre + data;
		if(options.verbose || process.env.DANSA_DB_VERBOSE_CREATE){
			console.log(data);
		}

		that.query(data, [], callback);
	});
};

