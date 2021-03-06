var express = require('express');
var app     = express();
var server  = require('http').Server(app);
var path    = require('path');

var routes  = require('./routes/index');

var twitter = require('./lib/twitter');


app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


app.get('/', routes.index);


server.listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});

twitter.listen(server);
