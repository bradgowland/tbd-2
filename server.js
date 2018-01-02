var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");
var instrumentArray = [];

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendfile('index.html');
});

app.get('/session/:name', function(req, res){
  res.send('session '+ req.params.name);
});

// initial grid state
var grids = [];
var grid = [];
var row = [];

var rows = 16;
var cols = 32;


io.on('connection', function(socket){
  // connection console check
  console.log('A user connected');
	// This should update the instruments when a user connects
  for(i = 0;i<grids.length;i++){
    socket.emit('newInstReturn', instrumentArray[i]);
  }


  socket.emit('connection', {
    grid: grids
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
    // console.log(data);
    grids[data.inst][data.row][data.column] *= -1;
    
    // send step to clients
    io.emit('stepreturn', data);
  });

  
  // create new instrument and correstponding grid
  socket.on('newInst',function(data){
    io.emit('newInstReturn', data);
    instrumentArray.push(data)
    var instGrid = createGrid(data.rowCount,32);
    grids.push(instGrid)
    // console.log(grids);


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

  // clear grid contents
  socket.on('chatClearSend', function(data){
    // clear master grid state
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        grid[i][j] = -1;
      }
    }
    
    // send step to clients
    io.emit('chatClearReturn');
  });

  // msg to all users
  socket.on('chat to server', function(data){
    io.emit('chat to client', data); 
  });

  // additional callbacks here

});

// local server connection
http.listen(port, function(){
  console.log('listening on *:', port);
});

function createGrid(rows,columns){
  var newGrid = [];
  var newRow = []
  for(var i = 0; i < rows; i++){
    for(var k = 0; k < cols; k++){
      newRow.push(-1);
    }
    newGrid.push(newRow);
    newRow = [];
    
  }
  return newGrid;
}
