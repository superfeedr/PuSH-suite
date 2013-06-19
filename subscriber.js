var http = require('http');
var express = require('express');

var app = express();

app.use(express.compress());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.errorHandler());

app.get('/callback', function(req, res) {
  var self = req.protocol + "://" + subscriber.hostname + req.originalUrl;
  res.setHeader('Link' , '<' + self + '>; rel="self";');
  if(req.query && req.query['hub.mode'] == "denied") {
    subscriber.denied(req);
    res.send(200, 'DAMMIT');
  }
  else if(req.query && (req.query['hub.mode'] == "subscribe" || req.query['hub.mode'] == "unsubscribe")) {
    if(req.query['wontconfirm']) {
      subscriber.verified(req);
      res.send(404);
    }
    else {
      subscriber.verified(req);
      res.send(200, req.query['hub.challenge']);
    }
  }
  else {
    res.send(200, 'WHAT?');
  }
});

app.post('/callback', function(req, res) {
  subscriber.notified(req, res);
});


var subscriber = http.createServer(app);

subscriber.hostname = '0.0.0.0:3002';

subscriber.notified = function (req, res) {
  // This should ve overriden by the tests!
}

subscriber.denied = function(req) {
  // This should have been overridden by the tests.
};

subscriber.verified = function(req) {
  // This should have been overridden by the tests.
}


module.exports = subscriber
