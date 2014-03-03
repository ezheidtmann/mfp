var express = require('express')
  , connect = require('connect')
  , app = express()
  , routes = require('./routes.js')
  ;

// Logging? Not sure where it goes.
app.use(connect.logger());

// Automatically parse JSON request bodies
app.use(connect.json());

// Not sure what this does
app.use(connect.methodOverride());

// Parse querystring into req.query
app.use(connect.query());

// Yay routes!
app.use(app.router);
routes(app);

// Serve static files, if there is no dynamic route
app.use('/', connect.static(__dirname + '/htdocs'));

// Dev-zone error handler. Disable on production.
app.use(connect.errorHandler());

app.listen(4000, function() {
  console.log('Listening on *:4000')
});
