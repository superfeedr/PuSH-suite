var urlParser = require('url');
var request = require('supertest'),
assert = require('assert'),
_ = require('underscore');

var publisher = require('./publisher.js'),
subscriber = require('./subscriber.js');

// https://superfeedr-misc.s3.amazonaws.com/pubsubhubbub-core-0.4.html

var longTimeout = 1000000;
var hostname =  process.env.HOSTNAME || '0.0.0.0';

if(! process.env.HUB_URL) {
  console.log('Please setup an environment HUB_URL var.');
  process.exit('1')
}

publisher.hub =  process.env.HUB_URL
publisher.port = 3001;
subscriber.port = 3002
publisher.hostname = [hostname, publisher.port].join(':');
subscriber.hostname = [hostname, subscriber.port].join(':');

describe('PubSubHubbub', function () {

  before(function(done) {
    var ready = _.after(2, done);
    publisher.listen(publisher.port, ready);
    subscriber.listen(subscriber.port, ready);
  });

  describe('discovery', function() {
    describe('the publisher', function() {
      var resource;
      before(function(done) {
        request(publisher).get('/resource').expect(200, function(err, res) {
          resource = res;
          done();
        });
      })

      it('should serve the resources with a link header pointing to a self url', function() {
        assert(resource.links.self);
      });
      it('should serve the resources with a link header pointing to the right hub', function() {
        assert.equal(resource.links.hub, publisher.hub);
      });
    });
  });

  describe('subscribing', function() {
    var resource, callback;

    before(function(done) {
      request(publisher).get('/resource?hub=' + publisher.hub).expect(200, function(err, res) {
        resource = res;
        request(subscriber).get('/callback').expect(200, function(err, res) {
          callback = res
          done();
        });
      });
    });

    after(function(done) {
      subscriber.verified = function(request) {
      };
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=unsubscribe').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self).
      end(done);
    });

    it('should return a 202 when issuing a valid subscription request', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self).
      expect(202, done);
    });

    it('should accept http callback urls', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self).
      expect(202, done);
    });

    it('should accept https callback urls', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self.replace('http', 'https')).
      expect(202, done);
    });

    it('should accept callback urls with extra string parameters', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self + '?param=extra').
      expect(202, function() {
        request(publisher.hub).
        post('/').
        type('form').
        send('hub.mode=unsubscribe').
        send('hub.topic=' + resource.links.self).
        send('hub.callback=' + callback.links.self + '?param=extra').
        expect(202, done);
      });
    });

    it('should accept only the self link provided by the discovery phase, if there is any', function(done) {
      var parsed = urlParser.parse(resource.links.self);
      parsed.search = '?somextra';
      delete parsed.href;
      delete parsed.path;
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + urlParser.format(parsed)).
      send('hub.callback=' + callback.links.self).
      expect(422, done);
    });

    it('should return a 4xx when issuing a invalid subscription request with no hub.callback and provide the right error in the body', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + resource.links.self).
      expect(422, /hub\.callback/, done);
    });

    it('should return a 4xx when issuing a invalid subscription request with no hub.mode and provide the right error in the body', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self).
      expect(422, /hub\.mode/, done);
    });

    it('should return a 4xx when issuing a invalid subscription request with no hub.topic and provide the right error in the body', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.callback=' + callback.links.self).
      expect(422, /hub\.topic/, done);
    });

    it('should ignore extra parameters they do not understand', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self).
      send('another=param').
      expect(202, done);
    });

    it('should accept re-subscriptions', function(done) {
      request(publisher.hub).
      post('/').
      type('form').
      send('hub.mode=subscribe').
      send('hub.topic=' + resource.links.self).
      send('hub.callback=' + callback.links.self).
      expect(202, function() {
        request(publisher.hub).
        post('/').
        type('form').
        send('hub.mode=subscribe').
        send('hub.topic=' + resource.links.self).
        send('hub.callback=' + callback.links.self).
        expect(202, done);
      });
    });

    describe('subscription validation', function() {
      var denied;
      before(function(done) {
        this.timeout(longTimeout);
        subscriber.denied = function(request) {
          denied = request;
          done();
        }
        request(publisher.hub).
        post('/').
        type('form').
        send('hub.mode=subscribe').
        send('hub.topic=' + encodeURIComponent(resource.links.self)).
        send('hub.callback=' + encodeURIComponent(callback.links.self + '?publisher=denied')).
        expect(202, function(err, res) {

        });

      })
      it('should inform the subscriber when the subscription has been denied by the publisher', function() {
        assert.equal(denied.query['hub.mode'], "denied");
      });

      it('should inform the subscriber when the subscription has been denied by the publisher with the right hub.topic', function() {
        assert.equal(denied.query['hub.topic'], resource.links.self);
      });
    });

    describe('hub verifies intent of the subscriber', function() {
      describe('verification details', function() {

        before(function(done) {
          this.timeout(longTimeout);
            subscriber.verified = function(request) {
              verification = request;
              done();
            }
              request(publisher.hub).
              post('/').
              type('form').
              send('hub.mode=subscribe').
              send('hub.topic=' + encodeURIComponent(resource.links.self)).
              send('hub.callback=' + encodeURIComponent(callback.links.self)).
              expect(202, function(err, res) {
                // We need to wait!
              });
        })
        it('should verify the intent of the subscriber when the publisher has accepted the subscription', function() {
          assert(verification);
        });
        it('should include the hub.mode', function() {
          assert.equal(verification.query['hub.mode'], "subscribe");
        });
        it('should include the hub.topic', function() {
          assert.equal(verification.query['hub.topic'], resource.links.self);
        });
        it('should include a hub.challenge', function() {
          assert(verification.query['hub.challenge']);
        });
        it('should include the hub.lease_seconds', function() {
          assert.equal(parseInt(verification.query['hub.lease_seconds']).toString(), verification.query['hub.lease_seconds']);
        });
      });
    });
  });

  describe('content distribution', function() {

    describe('when the subscription has been validated, verified and accepted', function() {

      var resource, callback;
      before(function(done) {
        this.timeout(longTimeout);
        request(publisher).get('/resource').expect(200, function(err, res) {
          resource = res;
          subscriber.verified = function(request) {
            done();
          }
          request(subscriber).get('/callback').expect(200, function(err, res) {
            callback = res.links.self;
            request(publisher.hub).
            post('/').
            type('form').
            send('hub.mode=subscribe').
            send('hub.topic=' + encodeURIComponent(resource.links.self)).
            send('hub.callback=' + encodeURIComponent(callback)).
            expect(202, function(err, res) {});
          });
        });
      });

      after(function(done) {
        subscriber.verified = function(request) {
        };
        request(publisher.hub).
        post('/').
        type('form').
        send('hub.mode=unsubscribe').
        send('hub.topic=' + encodeURIComponent(resource.links.self)).
        send('hub.callback=' + encodeURIComponent(callback)).
        end(done);
      });

      describe('when the subscriber serves a 2XX response code', function() {

        function parseLinkHeader(linksHeader) {
          var result = {};
          var entries = linksHeader.split(',');

          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i].trim();
            var key = /rel="(.*)"/.exec(entry)[1];
            var source = /^<(.*)>/.exec(entry)[1];
            result[key] = source;
          }

          return result;
        };
        var notification;

        before(function(done) {
          this.timeout(longTimeout);
          subscriber.notified = function(req, res) {
            notification = req;
            res.send(200, '');
            done();
          }
          publisher.publish();
        });

        it('should send a POST request to the subscriber\'s callback', function() {
          assert.equal(notification.method, 'POST');
        });
        it('should have the right Content-Type', function() {
          assert.equal(resource.headers['content-type'].split(';')[0], notification.headers['content-type'].split(';')[0]);
        });
        it('should include a self Link header', function() {
          assert.equal(resource.links.self, parseLinkHeader(notification.headers.link).self)
        });
        it('should include a hub Link header', function() {
          assert.equal(resource.links.hub, parseLinkHeader(notification.headers.link).hub)
        });

      });

      describe('when the subscriber does not serve a 2XX response code', function() {
        it('should retry', function(done) {
          var failed = 0;
          subscriber.notified = function(req, res) {
            failed += 1;
            if(failed == 1) {
              res.send(200, 'THANKS');
              done();
            }
            else {
            res.send(400, 'NOPE');
            }
          }
          publisher.publish();
        })
      });

    });
    describe('when the subscription has been denied', function() {
      it('should not send anything to denied subscriptions')
    });
    describe('when the subscription has been validated, but not verified', function() {
      it('should not send anything to not validated')
    });
  });

  describe('authenticated content distribution', function() {
    it('should include a valid hub.signature param if a hub.secret was supplied upon subscription');
  });
});

