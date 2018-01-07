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

  // delete instrument
  socket.on('deletetab',function(data){
    instrumentArray.splice(data.tab2delete,1);
    grids.splice(data.tab2delete,1);
    console.log('Delete the ',data.tab2delete);
    io.emit('deletereturn',data);

  })

  // clear grid contents
  socket.on('clearcurrent', function(data){
    // clear current grid state
    var currentGrid = grids[data.inst]
    for (var i = 0; i < currentGrid.length; i++) {
      for (var j = 0; j < cols; j++) {
        grids[data.inst][i][j] = -1;
      }
    }
    
    // send clear messagw to clients
    io.emit('clearcurrentreturn',{
      inst: data.inst,
      grids: grids
    });
  });  

  socket.on('clearall', function(){
    // clear current grid state
    console.log('Clear all')
    for(var h = 0; h < grids.length; h++){
      var currentGrid = grids[h];
      for (var i = 0; i < currentGrid.length; i++) {
        for (var j = 0; j < cols; j++) {
          grids[h][i][j] = -1;
        }
      }
    }
    
    // send clear messagw to clients
    io.emit('clearallreturn',{grids: grids});
  }); 

  socket.on('tempo', function(data){
    io.emit('temporeturn', data);
  }) 

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
