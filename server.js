var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendfile('index.html');
});

app.get('/session/:name', function(req, res){
  res.send('session '+ req.params.name);
});

// initial grid state
var grid = [];
var row = [];

var rows = 16;
var cols = 32;

for(var i = 0; i < rows; i++){
  for(var k = 0; k < cols; k++){
    row.push(-1);
  }
  grid.push(row);
  row = [];
}

io.on('connection', function(socket){
  // connection console check
  console.log('A user connected');
	socket.emit('connection', {
    grid: grid
  });

  // timeout warning console check
  setTimeout(function(){
    socket.send('Sent a message 4 seconds after connection!');
  }, 4000);
  
  // disconnect console check
  socket.on('disconnect', function () {
    console.log('A user disconnected');
  });
  
  // distribute user step changes
  socket.on('step', function(data){
    // track master grid state
    grid[data.row][data.column] = grid[data.row][data.column] * -1;
    
    // send step to clients
    io.emit('stepreturn', data);
  });

  // clear grid contents
  socket.on('clearSend', function(data){
    // clear master grid state
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        grid[i][j] = -1;
      }
    }
    
    // send step to clients
    io.emit('clearReturn');
  });  

  // additional callbacks here

});

// local server connection
http.listen(port, function(){
  console.log('listening on *:', port);
});
