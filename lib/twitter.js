require("https").globalAgent.maxSockets = 50000;

// In production, place these some place secure.
var CONSUMER_KEY    = "CmL6AOz5GnCPQ0SxpVYw"
  , CONSUMER_SECRET = "1qLBGnZrrJUR1SONCJBFnprHNFOiXgCebwkw017SCc";

var ACCESS_TOKEN  = "9615422-mZpZyCVTdW5HYQTE1u9amLgvpNuqesxoQZIRskc4"
  , ACCESS_SECRET = "qIG1QlgHMJFwAOLxoU7vQdccO0KhZLcZHzp4pjlkBU";

var OAuth = require('oauth').OAuth,
    oauth = new OAuth("https://twitter.com/oauth/request_token",
                      "https://twitter.com/oauth/access_token",
                      CONSUMER_KEY,
                      CONSUMER_SECRET,
                      "1.0A",
                      null,
                      "HMAC-SHA1");




var socketio = require('socket.io');

var requestsByQuery = {};
var currentQuery = {};


exports.listen = function(server) {
  io = socketio.listen(server);

  io.sockets.on('connection', function(socket) {
    handleQueryChange(socket);

    socket.on('disconnect', function() {
      disassociateUser(socket, currentQuery[socket.id]);
    });
  });
}


function handleQueryChange(socket) {
  socket.on('change-query', function(query) {
    query = query.trim();

    if (isBlank(query)) {
      return socket.emit('progress-update', {status: 'invalid-query'});
    }

    // new query?
    if (query === currentQuery[socket.id]) {
      return;
    }

    disassociateUser(socket, currentQuery[socket.id]);

    if (isNull(requestsByQuery[query]) || isUndefined(requestsByQuery[query])) {
      console.log(socket.id, " is creating request for '", query, "'");
      createNewRequest(query);
    }

    socket.join(query);
    currentQuery[socket.id] = query;

    console.log(socket.id, " has joined '", query, "'");
    console.log("Active queries: ", Object.keys(requestsByQuery));
  });
}

function createNewRequest(query) {
  var request = oauth.get(getStatusUrl(query), ACCESS_TOKEN, ACCESS_SECRET);
  requestsByQuery[query] = request;

  request.addListener('response', function(response) {
    response.setEncoding('utf8');

    // We got a response!
    response.addListener('data', function(chunk) {
      var json = dataChunkToJson(chunk);
      if (json != null) {
        if (isUndefined(json.text)) {
          return console.log("Discarding bad response for '", query, "'");
        }
        io.sockets.in(query).emit('new-tweet', { text: json.text, user: {screen_name: json.user.screen_name}});
      }
    });

    // Twitter has ended the connection.
    response.addListener('end', function() {
      disassociateAll(io.sockets.clients(query), query);
    });
  });

  request.addListener('error', function(error) {
    console.log("API Error: ", error);
    disassociateAll(io.sockets.clients(query), query);
  });

  request.end();
}

// Remove users from getting any more updates for a specific query.
function disassociateAll(sockets, query) {
  sockets.forEach(function(socket) {
    disassociateUser(socket, query);
  });
}

// Remove a user from getting any more updates for a specific query.
function disassociateUser(socket, query) {
  socket.leave(query);
  if (io.sockets.clients(query).length == 0) {
    console.log("No more clients interested in '", query, "'. Closing stream.");
    var request = requestsByQuery[query];
    if (request) {
      request.socket.destroy();
      delete requestsByQuery[query];
    }
  }
}


// Utility functions

function isNull(obj) {
  return obj === null;
}

function isUndefined(obj) {
  return obj === undefined;
}

function isBlank(obj) {
  return isNull(obj) || isUndefined(obj) || obj.trim() === "";
}

function getStatusUrl(query) {
  return "https://stream.twitter.com/1.1/statuses/filter.json?delimited=length&track=" + query;
}

function dataChunkToJson(chunk) {
  try {
    return JSON.parse(chunk.toString('utf8').split('\r\n')[1]);
  } catch (error) {
    return null;
  }
}
