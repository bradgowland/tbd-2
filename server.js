var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");

// TODO: Keeping track of grids:
// Make a nested loop to construct arrays to keep track of polarity every time the grid constructor gets a call

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendfile('index.html');
});

app.get('/session/:name', function(req, res){
  res.send('session '+ req.params.name);
});

io.on('connection', function(socket){
  // connection console check
  console.log('A user connected');
	  socket.emit('connection');

socket.on('step', function(data){
  console.log(data);
  io.emit('stepreturn', data);


});

  // timeout warning console check
  setTimeout(function(){
    socket.send('Sent a message 4seconds after connection!');
  }, 4000);
  
  // disconnect console check
  socket.on('disconnect', function () {
    console.log('A user disconnected');
  });
  
  // additional callbacks here

});

// local server connection
http.listen(port, function(){
  console.log('listening on *:', port);
});
