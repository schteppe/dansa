var express = require("express");
var path = require("path");
var serveStatic = require('serve-static');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var routes = require('./routes');

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

app.listen(port, function() {
    console.log("Listening on port " + port + " ("+app.get('env')+")");
});