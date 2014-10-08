// Load the http module to create an http server.
var http = require('http');

// Configure our HTTP server to respond with Hello World to all requests.
var server = http.createServer(function (request, response) {
  response.writeHead(200, {"Content-Type": "text/plain"});
  response.end("Hello World\n");
});

var port = Number(process.env.PORT || 5000);
server.listen(port);

// Put a friendly message on the terminal
console.log("Server running on port " + port);