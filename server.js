var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");
var instrumentArray = [];
var sessions = [];
var rooms = [];
var roomID = "";
var roomIndex = -1;

app.use(express.static('public'));

// dynamic url for rooms
app.get('/:dynamicroute', function(req,res) {
  res.sendFile(__dirname + '/public/index.html')
});

io.on('connection', function(socket){
  // connection console check
  console.log('A user connected');

  // connect socket to room
  socket.on('room', function(data) {
    roomID = data.roomID;
    socket.join(roomID);
    // TODO: instantiate new session or return existing session
    roomIndex = rooms.indexOf(roomID);
    if (roomIndex > -1) {
        sessions[roomIndex].onConnection();
    } else {
      rooms.push(roomID);
      roomIndex = sessions.push(new session(roomID));
      roomIndex -= 1;
    }
  });

  // TODO: Delete when not needed: should be superceded by onConnection method
	// This should update the instruments when a user connects
  // for(i = 0;i<grids.length;i++){
  //   socket.emit('newInstReturn', instrumentArray[i]);
  // }
  //
  //
  // socket.emit('connection', {
  //   grid: grids
  // });

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
    sessions[getIx(data.roomID)].instruments[data.inst].grid[data.row][data.column] *= -1;
    // send step to clients
    io.to(data.roomID).emit('stepreturn', data);
  });


  // create new instrument and correstponding grid
  socket.on('newInst',function(data){
    io.to(data.roomID).emit('newInstReturn', data);
    sessions[getIx(data.roomID)].instruments.push(new TBDinstrument(data.name,data.rows,32,data.type));
  });

  // delete instrument
  socket.on('deletetab',function(data){
    sessions[getIx(data.roomID)].instruments.splice(data.tab2delete,1);
    console.log('Delete the ',data.tab2delete);
    io.to(data.roomID).emit('deletereturn',data);
  })

  // clear grid contents
  socket.on('clearcurrent', function(data){
    // clear current grid state
    sessions[getIx(data.roomID)].instruments[data.inst].clear();
  // send clear message to clients
    io.emit('clearcurrentreturn',{
      inst: data.inst,
    });
  });

  socket.on('clearall', function(){
    // clear current grid state
    console.log('Clear all')
    for(var i = 0; i < sessions[getIx(data.roomID)].instruments.length; i++){
      sessions[getIx(data.roomID)].instruments[i].clear();
    }

    // send clear messagw to clients
    io.to(data.roomID).emit('clearallreturn');
  });

  socket.on('tempo', function(data){
    sessions[getIx(data.roomID)].tempo = data.tempo*60;
    io.to(data.roomID).emit('temporeturn', data);
  })



  // msg to all users
  socket.on('chat to server', function(data){
    io.to(data.roomID).emit('chat to client', data);
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


function TBDinstrument(name, rows, cols, type){
	this.rows = rows;
	this.cols = cols;
	this.name = name;
  this.type = type;
	this.clear = function(){
		this.grid = createGrid(this.rows,this.columns);
	}
	// Create the polarity grid for click/unclick
	this.grid = createGrid(rows,cols);

}

function session(roomID){
  // always run on instantiation
  this.onConnection();

  this.roomID = roomID;
  this.users = [];
  this.instruments = [];
  this.tempo = 120;
  this.sync = function(){
    // TODO: callback in script.js to receive sync
    io.to(this.roomID).emit('joinSession');
  }
  this.onConnection = function(){
    // TODO: fill in all data to send
    socket.emit('joinSession',
      {
        users: this.users,
        instruments: this.instruments,
        tempo: this.tempo
      });
  }

}

function getIx(roomID){
  return rooms.indexOf(roomID);
}
