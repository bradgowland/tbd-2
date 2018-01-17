var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");
var instrumentArray = [];
// session objects
var sessions = [];
// names of all rooms
var rooms = [];
var roomID = "";
var roomIndex = -1;

app.use(express.static('public'));

// dynamic url for rooms
// test
app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html')
});
app.get('/:dynamicroute', function(req,res) {
  res.sendFile(__dirname + '/public/app.html')
});

io.on('connection', function(socket){
  // connection console check
  console.log('A user connected');

  // timeout warning console check
  setTimeout(function(){
    socket.send('Sent a message 4 seconds after connection!');
  }, 4000);

  // disconnect console check
  socket.on('disconnect', function () {
    console.log('A user disconnected');
  });

  // connect socket to room
  socket.on('room', function(data) {
    roomID = data.roomID;
    socket.join(roomID);
    // instantiate new session or return existing session
    roomIndex = rooms.indexOf(roomID);
    if (roomIndex > -1) {
        sessions[roomIndex].onConnection(socket);
        console.log('We found ',roomID);
    } else {
      rooms.push(roomID);

      console.log('Creating ', roomID);

      roomIndex = sessions.push(new session(roomID,socket));
      roomIndex -= 1;
      sessions[roomIndex].instruments.push( new TBDinstrument('Default',20,32,{
      	midiNotes: [],
      	scale: [0,2,4,5,7,9,11],
      	labels: [],
      	rows: 0,
      	melodic: 1
      }));
      sessions[roomIndex].onConnection(socket);
    }
  });

  // add user to session by roomID
  socket.on('user', function(data) {
    roomID = data.roomID;
    username = data.username;

    // find room, add user
    roomIndex = rooms.indexOf(roomID);
    sessions[roomIndex].users.push(username);

    // send full user list to all users in rooms
    io.to(data.roomID).emit('update users', {users: sessions[roomIndex].users});

    // console check
    console.log("Users in ", roomID, ": ", sessions[roomIndex].users)
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

  socket.on('clearall', function(data){
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

  socket.on('reversex',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversex();
    console.log(sessions[getIx(data.roomID)].instruments[data.inst].grid);
    io.to(data.roomID).emit('reversexreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid

    });
  });

  socket.on('reversey',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversey();
    console.log('Reversed the grid in '+data.roomID+'');
    io.to(data.roomID).emit('reverseyreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid

    });
  });



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
    for(var k = 0; k < columns; k++){
      newRow.push(-1);
    }
    newGrid.push(newRow);
    newRow = [];

  }
  return newGrid;
}

// instrument object
function TBDinstrument(name, rows, cols, type){
	this.rows = rows;
	this.cols = cols;
	this.name = name;
  this.type = type;
  if(type.rows){
    this.rows = type.rows;
  }
  this.grid = createGrid(this.rows,cols);
	this.clear = function(){
		this.grid.forEach(function(row){
      row.fill(-1);
    });
	}

  this.reversex = function(){
    for(i=0;i<this.grid.length;i++){
      this.grid[i].reverse();
    }
  }

  this.reversey = function(){
    this.grid.reverse();
  }
	// Create the polarity grid for click/unclick

}

// session object
function session(roomID,socket){
  this.roomID = roomID;
  this.users = [];
  this.instruments = [];
  this.tempo = 120;

  this.sync = function(){
    // TODO: callback in script.js to receive sync
    io.to(this.roomID).emit('joinSession');
  }
  this.onConnection = function(socket){
    // TODO: fill in all data to send
    socket.emit('joinSession',
      {
        users: this.users,
        instruments: this.instruments,
        tempo: this.tempo
      });
  }

}

// TODO: fix this up with everything you need for a personal edit history
function user(username) {
  // stuff like:
  // this.undo
  // this.redo
  // this.private
  // this.pushChanges
}

function getIx(roomID){
  return rooms.indexOf(roomID);
}
