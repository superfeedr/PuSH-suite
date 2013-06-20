var http = require('http');
var sockjs = require('sockjs');
var node_static = require('node-static');
var spawn = require('child_process').spawn;

var testArgs = ['/usr/local/lib/node_modules/mocha/bin/_mocha', 'test.js','--reporter','spec','-bail','-t','10000', '--reporter', 'json-stream'];
message = 'http://pubsubhubbub.superfeedr.com'


// 1. Echo sockjs server
var sockServer = sockjs.createServer({sockjs_url: "http://cdn.sockjs.org/sockjs-0.3.min.js"});
sockServer.on('connection', function(conn) {
  var proc;
  function send(data) {
    conn.write(data);
  }
  conn.on('data', function(message) {
    if(message) {
      var env = process.env;
      env['HUB_URL'] = message;
      proc = spawn('/usr/local/bin/node', testArgs, {env: env});
      proc.stdout.on('data', send);
      proc.stderr.on('data', send);
      proc.on('close', function() {
        console.log('proc finished, deleting it')
        delete proc;
      })
    }
  });
  conn.on('close', function() {
    console.log('connection closed');
    if(proc) {
      console.log('Killing proc');
      proc.kill("SIGINT");
    }
  })
});

// 2. Static files server
var static_directory = new node_static.Server(__dirname);

// 3. Usual http stuff
var server = http.createServer();
server.addListener('request', function(req, res) {
  static_directory.serve(req, res);
});
server.addListener('upgrade', function(req,res){
  res.end();
});

sockServer.installHandlers(server, {prefix:'/test-stream'});

server.listen(9999);

