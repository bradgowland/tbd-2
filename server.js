var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");
var mongodb = require('mongodb');
var uri = 'mongodb://heroku_wzrt98pf:o60ajjk1lrsa5d23ohlf7auoes@ds117888.mlab.com:17888/heroku_wzrt98pf';

var instrumentArray = [];
// session objects
var sessions = [];
// names of all rooms
var rooms = [];
// session activity logs for all rooms
var logs = [];
var roomID = "";
var roomIndex = -1;
var start;

app.use(express.static('public'));

// dynamic url for rooms
app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html')
});
// page to retrieve activity logs
// TODO: can be deleted if/when mongo replaces this
app.get('/logs', function(req,res) {
  res.send(logs)
});
app.get('/:dynamicroute', function(req,res) {
  res.sendFile(__dirname + '/public/app.html')
});

// check each minute for cleaning up rooms older than 1 day, update db logs
setInterval(function() {
  console.log("Checking for timed-out sessions at current time ", new Date())
  checkSessionAge();
  // TODO: not written
  updateDB();
}, 60000);

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
        logs[roomIndex].createLog("User accessed existing room.")
    } else {
      rooms.push(roomID);
      console.log('Creating ', roomID);

      roomIndex = sessions.push(new session(roomID,socket));
      roomIndex -= 1;
      sessions[roomIndex].instruments.push( new TBDinstrument('TBD',20,32,{
      	midiNotes: [],
      	scale: [0,2,4,5,7,9,11],
      	labels: [],
      	rows: 0,
      	melodic: 1
      }));
      sessions[roomIndex].onConnection(socket);

      // get created time
      sessions[getIx(roomID)].created = new Date();
      console.log("New room created at ", new Date(sessions[getIx(roomID)].created));

      // create session log object and log initial event
      logs.push(new log(roomID));
      logs[roomIndex].createLog("Created room.");
    }
  });

  // add user to session by roomID
  socket.on('user', function(data) {
    roomID = data.roomID;
    username = data.username;

    // find room, add user
    roomIndex = rooms.indexOf(roomID);
    sessions[roomIndex].users.push(username);
    logs[roomIndex].createLog("New user.");

    // send full user list to all users in rooms
    io.to(data.roomID).emit('update users', {users: sessions[roomIndex].users});

    // console check
    console.log("Users in ", roomID, ": ", sessions[roomIndex].users);
  });

  // distribute user step changes
  socket.on('step', function(data){
    if(data.start){
      start = data.column;
    }
    if(data.mousemode === 2){
      for(i=0;i<3;i++){
        if(data.row >= 0){
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.row][data.column] *= -1;
          if(data.shifted){
            data.mousemode = 3;
          }else{
            data.mousemode = 0;
          }
          io.to(data.roomID).emit('stepreturn', data);
          data.row -= 2;
        }
      }
    }else if(data.mousemode == 1){
      sessions[getIx(data.roomID)].instruments[data.inst].grid[data.row][data.column] = -1;
      io.to(data.roomID).emit('stepreturn', data);
    }else{
      sessions[getIx(data.roomID)].instruments[data.inst].grid[data.row][data.column] *= -1;
      if(data.shifted){
        data.mousemode = 3;
      }
    // send step to clients
    io.to(data.roomID).emit('stepreturn', data);
    // log event
    logs[getIx(data.roomID)].createLog("Step change.");
  }
  });

  // create new instrument and correstponding grid
  socket.on('newInst',function(data){
    io.to(data.roomID).emit('newInstReturn', data);
    sessions[getIx(data.roomID)].instruments.push(new TBDinstrument(data.name,data.rows,32,data.type));
    logs[getIx(data.roomID)].createLog("New instrument.");
  });

  // delete instrument
  socket.on('deletetab',function(data){
    sessions[getIx(data.roomID)].instruments.splice(data.tab2delete,1);
    console.log('Delete the ',data.tab2delete);
    console.log(sessions[getIx(data.roomID)].instruments)
    io.to(data.roomID).emit('deletereturn',data);
    logs[getIx(data.roomID)].createLog("Deleted instrument.");
  })

  // clear grid contents
  socket.on('clearcurrent', function(data){
    // clear current grid state
    sessions[getIx(data.roomID)].instruments[data.inst].clear();
    // send clear message to clients
    io.emit('clearcurrentreturn',{
      inst: data.inst,
    });
    logs[getIx(data.roomID)].createLog("Grid cleared.");
  });

  socket.on('clearall', function(data){
    // clear current grid state
    console.log('Clear all')
    for(var i = 0; i < sessions[getIx(data.roomID)].instruments.length; i++){
      sessions[getIx(data.roomID)].instruments[i].clear();
    }

    // send clear messagw to clients
    io.to(data.roomID).emit('clearallreturn');

    logs[getIx(data.roomID)].createLog("All grids cleared.");
  });



  socket.on('tempo', function(data){
    sessions[getIx(data.roomID)].tempo = data.tempo*60;
    io.to(data.roomID).emit('temporeturn', data);
    logs[getIx(data.roomID)].createLog("Tempo changed.");
  })

  socket.on('reversex',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversex();
    console.log(sessions[getIx(data.roomID)].instruments[data.inst].grid);
    io.to(data.roomID).emit('reversexreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid
    });
    logs[getIx(data.roomID)].createLog("X axis revesed.");
  });

  socket.on('reversey',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversey();
    console.log('Reversed the grid in '+data.roomID+'');
    io.to(data.roomID).emit('reverseyreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid
    });
    logs[getIx(data.roomID)].createLog("Y axis revesed.");
  });



  // msg to all users
  socket.on('chat to server', function(data){
    // distribute message
    io.to(data.roomID).emit('chat to client', data);

    // update stored chat history in session, max 50 messages
    if (sessions[getIx(data.roomID)].messages.length < 100) {
      sessions[getIx(data.roomID)].messages.push(data.username);
      sessions[getIx(data.roomID)].messages.push(data.message);
    } else {
      sessions[getIx(data.roomID)].messages.splice(0,2);
      sessions[getIx(data.roomID)].messages.push(data.username);
      sessions[getIx(data.roomID)].messages.push(data.message);
    }
    logs[getIx(data.roomID)].createLog("Chat sent.");
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
  // TODO: delete when we're done fixing up on/off grids
  this.grid = createGrid(this.rows,cols);
  this.onGrid = createGrid(this.rows,cols);
  this.offGrid = createGrid(this.rows,cols);
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
function session(roomID, socket){
  this.roomID = roomID;
  this.users = [];
  this.instruments = [];
  this.tempo = 120;
  this.created = 0;
  this.messages = [];

  // TODO: callback in script.js to receive sync - this does nothing right now
  this.sync = function(){
    io.to(this.roomID).emit('joinSession');
  }

  this.onConnection = function(socket){
    // send session data to new connection
    socket.emit('joinSession',
    {
      users: this.users,
      instruments: this.instruments,
      tempo: this.tempo,
    });
    // update recent chat history for new connection
    for (i = 0; i < this.messages.length; i+=2) {
      io.to(this.roomID).emit('chat history',
      {
        username: this.messages[i],
        message: this.messages[i+1],
        roomID: this.roomID
      });
    }
  }
}

// activity log object
function log(roomID) {
  this.roomID = roomID;
  this.activity = [];
  this.createLog = function(type) {
    this.activity.push(new Date + ": " + type);
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

// check for sessions older than five days, executed on timer
function checkSessionAge() {
  for (i = sessions.length - 1; i >= 0; i --) {
    if (new Date() - sessions[i].created > 86400000 * 5) {
      console.log("Removing " + sessions[i].roomID + ", created at: " + new Date(sessions[i].created));
      sessions.splice(i,1);
      rooms.splice(i,1);
      logs.splice(i,1);
      console.log(sessions.length + " sessions remain.")
    }
  }
}

function updateDB() {
  mongodb.MongoClient.connect(uri, function(err, db) {
    if(err) throw err;

    var dblogs = db.collection('logs');

    dbLogs.insert(logs, function(err, result) {
      if(err) throw err;
    });

    // clear out logs if successfully added to db
    logs = [];
    console.log('Logs successfully added to db.')
  });
}

function getIx(roomID){
  return rooms.indexOf(roomID);
}
