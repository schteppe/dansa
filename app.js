var express = require("express");
var path = require("path");
var serveStatic = require('serve-static');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var routes = require(path.join(__dirname, 'routes'));
var Middleware = require(path.join(__dirname, 'src', 'Middleware'));
var db = require(path.join(__dirname, 'src', 'Database'));

var app = express();

var port = Number(process.env.PORT || 5000);

app.set('port', port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(serveStatic(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get ('/', routes.index);
app.get ('/play', routes.play);
app.get ('/setup', routes.setup);
app.get ('/songs/new', routes.newSong);
app.post('/songs/new', routes.save);
app.get ('/songs/:id', Middleware.getSong(), routes.viewSong);
app.get ('/songs/:id/play', Middleware.getSong(), routes.playSong);
app.get ('/songs/:id/edit', Middleware.getSong(), routes.editSong);
app.post('/songs/:id/edit', Middleware.getSong(), routes.save);

db.sync({
	verbose: true
}, function (err){
	if(err) throw err;

	app.listen(port, function() {
		console.log("Listening on port " + port + " ("+app.get('env')+")");
	});
});