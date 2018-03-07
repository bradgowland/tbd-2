var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");
const MongoClient = require('mongodb').MongoClient;
const uri = 'mongodb://heroku_wzrt98pf:o60ajjk1lrsa5d23ohlf7auoes@ds117888.mlab.com:17888/heroku_wzrt98pf';
const dbName = 'heroku_wzrt98pf';

var instrumentArray = [];
// session objects
var sessions = [];
// names of all rooms
var rooms = [];
// all socket clients
var clients = [];
var roomID = "";
var roomIndex = -1;
var start = [];
var selectedStep,clickOffset;

var userThatClicked = [];

app.use(express.static('public'));

// dynamic url for rooms
app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html')
});
app.get('/:dynamicroute', function(req,res) {
  res.sendFile(__dirname + '/public/app.html')
});

// check each hour for cleaning up rooms older than 1 day, update db logs
setInterval(function() {
  console.log("Checking for timed-out sessions at current time ", new Date())
  checkSessionAge();
}, 3600000);

io.on('connection', function(socket){
  // on connection
  console.log('A user connected');

  // timeout warning console check
  setTimeout(function(){
    socket.send('Sent a message 4 seconds after connection!');
  }, 4000);

  // on disconnect
  socket.on('disconnect', function () {
    if (clients.length > 0) {
      var clientIx = getClient(socket.id);

      if (typeof clients[clientIx] != 'undefined') {
        // find room and user
        var roomIndex = rooms.indexOf(clients[clientIx].roomID);
        var userIndex = sessions[roomIndex].users.indexOf(clients[clientIx].user);

        console.log("User ", clients[clientIx].user, " disconnected from room ", clients[clientIx].roomID);

        // remove user and client
        sessions[roomIndex].users.splice(clients[clientIx], 1);
        clients.splice(clientIx, 1);
        console.log("Remaining clients: ", clients);
      }
    }
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
        createLog(roomID, new Date(), "room accessed");
    } else {
      rooms.push(roomID);
      console.log('Creating ', roomID);

      roomIndex = sessions.push(new session(roomID,socket));
      roomIndex -= 1;
      sessions[roomIndex].instruments.push( new TBDinstrument('TBD',60,32,{
      	midiNotes: [],
      	scale: [0,1,2,3,4,5,6,7,8,9,10,11],
      	labels: [],
      	rows: 0,
      	melodic: 1
      },60));
      sessions[roomIndex].onConnection(socket);

      // get created time
      sessions[getIx(roomID)].created = new Date();
      console.log("New room created at ", new Date(sessions[getIx(roomID)].created));

      // create session log object and log initial event
      createLog(roomID, sessions[getIx(roomID)].created, "room created");
    }
  });

  // add user to session by roomID
  socket.on('user', function(data) {
    roomID = data.roomID;
    user = data.user;

    // TODO: capture client details
    clients.push(new client(socket, roomID, user));
    console.log("New client. Socket: ", socket.id, ", roomID: ", roomID, ", user: ", user);
    console.log("All clients: ", clients);

    // find room, add user
    roomIndex = rooms.indexOf(roomID);
    sessions[roomIndex].users.push(user);
    createLog(roomID, new Date(), "user added to room", user);

    // send full user list to all users in rooms
    io.to(data.roomID).emit('update users', {users: sessions[roomIndex].users});

    // console check
    console.log("Users in ", roomID, ": ", sessions[roomIndex].users);
  });


  var offix;
  // distribute user step changes
  socket.on('step', function(data){
    // console.log(data.state)
    data.onleft = false;
    data.onright = false;
    if(data.mousemode === 1){
      data.state = '';
    }
    data.state = data.shifted ? 'onoff':data.state;
    if(data.state === 'onoff'){
      sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].push(new TBDnote(data.column,data.column,data));
    }

    // flipped = false;
    if(data.state === 'on'){
      doubleCheck = userThatClicked.indexOf(data.user);
      if(doubleCheck > -1){
        userThatClicked.splice(doubleCheck,1);
        start.splice(doubleCheck,1);
      }
      userThatClicked.push(data.user);
      // console.log(' User '+data.user+'clicked ',data.column);
      start.push(data.column);

    }



    if(data.state === ''){
      //left of this cell.
      if(data.column>0){
      var left = sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state;
        switch(left){
          case 'sus':
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state = 'off';
          data.onleft = true;
          break;
          case 'on':
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state = 'onoff';
          data.onleft = true;
          break;
          default: data.onleft = false;
        }
      }

      if(data.column < sessions[getIx(data.roomID)].instruments[data.inst].cols - 1){
        var right = sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state;
        switch(right){
          case 'sus':
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state = 'on';
          data.onright = true;
          break;
          case 'off':
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state = 'onoff';
          data.onright = true;
          break;
          case 'onoff':
          data.onright = true;
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state = 'onoff';
          break;
          default: data.onright = false;
        }
      }
    }

    if (data.state === 'off') {
      offix = userThatClicked.indexOf(data.user);
      if (data.column === start[offix]) {
        data.state = 'onoff';
      } else {
        data.flipped = data.column < start[offix] ? true : false;
        console.log('Flipped?:  ', data.flipped);
        if(data.flipped){
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][start[offix]].state = 'off';
        } else {
          if(start[offix]){
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][start[offix]].state = 'on';
        }
        }
      }
      sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].push(new TBDnote(start[offix],data.column,data));
      // console.log(sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid]);
      // log event
      // console.log("step logged");
      createLog(data.roomID, new Date(), "step change", data.user, Math.abs(start[offix] - data.column)+1);

      // clean up
      userThatClicked.splice(offix,1);
      start.splice(offix,1);
    }

    if(data.state === 'move'){
      if(data.grab){
        selectedStep= sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].findIndex(function(el){
          return (el.row === data.row) && (el.on <= data.column) && (el.off >= data.column)
        });
        clickOffset = data.column - sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][selectedStep].on;

      }
      data.offset = clickOffset;


      if(selectedStep > -1){

        sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][selectedStep].move(data);
        // console.log(sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][selectedStep]);
      }
    }
    if(data.mousemode === 2) {
      for(i=0;i<3;i++){
        if(data.row >= 0){
          if(data.flipped){
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column].state = 'on';
          }else{
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column].state = data.state;
          }

          if(data.onleft && i){
            var left = sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state;
              switch(left){
                case 'sus':
                sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state = 'off';
                break;
                case 'on':
                sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state = 'onoff';
              }
          }
          if(data.onright && i){
            var right = sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state;
            switch(right){
              case 'sus':
              sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state = 'on';
              data.onright = true;
              break;
              case 'off':
              sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state = 'onoff';
              break;
              case 'onoff':
              sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state = 'onoff';
              break;
            }

          }
          io.to(data.roomID).emit('stepreturn', data);
          data.row -= 2;

        }
      }
      createLog(data.roomID, new Date(), data.user, "step chord");
    } else if (data.mousemode === 1) {
      data.state = '';
      sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column].state = data.state;
      io.to(data.roomID).emit('stepreturn', data);
      createLog(data.roomID, new Date(), data.user, "step erased");
    } else {
      if(data.shifted){
        data.state = 'onoff';
      }
      if (data.flipped) {
        sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column].state = 'on';
      } else {
        if(data.state != 'move'){
        sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column].state = data.state;
      }
      }
      // send step to clients

      io.to(data.roomID).emit('stepreturn', data);

    }
  });

  socket.on('delete step',function(data){
      sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].splice(data.noteIx,1);
      io.to(data.roomID).emit('delete step return', data);
  })

  // create new instrument and correstponding grid
  socket.on('newInst',function(data){
    io.to(data.roomID).emit('newInstReturn', data);
    sessions[getIx(data.roomID)].instruments.push(new TBDinstrument(data.name,data.rows,32,data.type,data.root));
    createLog(data.roomID, new Date(), "new isntrument", data.user);
  });

  socket.on('getgrid',function(data){
    data.grid = sessions[getIx(data.roomID)].instruments[data.inst].grid[data.gridix];
  io.to(data.roomID).emit('getgridreturn', data);
  })

  // delete instrument
  socket.on('deletetab',function(data){
    sessions[getIx(data.roomID)].instruments.splice(data.tab2delete,1);
    console.log('Delete the ',data.tab2delete);
    console.log(sessions[getIx(data.roomID)].instruments)
    io.to(data.roomID).emit('deletereturn',data);
    createLog(data.roomID, new Date(), "deleted isntrument", data.user);
  })

  // clear grid contents
  socket.on('clearcurrent', function(data){
    // clear current grid state
    sessions[getIx(data.roomID)].instruments[data.inst].clear(data.gridix);
    // send clear message to clients
    io.emit('clearcurrentreturn',{
      inst: data.inst,
    });
    createLog(data.roomID, new Date(), "grid cleared", data.user);
  });

  socket.on('clearall', function(data){
    // clear current grid state
    console.log('Clear all')
    for(var i = 0; i < sessions[getIx(data.roomID)].instruments.length; i++){
      sessions[getIx(data.roomID)].instruments[i].clear();
    }

    // send clear messagw to clients
    io.to(data.roomID).emit('clearallreturn');
    createLog(data.roomID, new Date(), "all grids cleared", data.user);
  });

  socket.on('tempo', function(data){
    sessions[getIx(data.roomID)].tempo = data.tempo;
    io.to(data.roomID).emit('temporeturn', data);
    createLog(data.roomID, new Date(), "tempo changed", data.user);
  })

  socket.on('reversex',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversex(data.gridix);
    // console.log(sessions[getIx(data.roomID)].instruments[data.inst].grid);
    io.to(data.roomID).emit('reversexreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid[data.gridix],
      gridix: data.gridix
    });
    createLog(data.roomID, new Date(), "x axis reversed", data.user);
  });

  socket.on('reversey',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversey(data.gridix);
    console.log('Reversed the grid in '+data.roomID+'');
    io.to(data.roomID).emit('reverseyreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid[data.gridix],
      gridix: data.gridix
    });
    createLog(data.roomID, new Date(), "y axis reversed", data.user);
  });



  // msg to all users
  socket.on('chat to server', function(data){
    // distribute message
    io.to(data.roomID).emit('chat to client', data);

    // update stored chat history in session, max 50 messages
    if (sessions[getIx(data.roomID)].messages.length < 100) {
      sessions[getIx(data.roomID)].messages.push(data.user);
      sessions[getIx(data.roomID)].messages.push(data.message);
    } else {
      sessions[getIx(data.roomID)].messages.splice(0,2);
      sessions[getIx(data.roomID)].messages.push(data.user);
      sessions[getIx(data.roomID)].messages.push(data.message);
    }
    createLog(data.roomID, new Date(), "chat sent", data.user);
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
      newRow.push(new step);
    }
    newGrid.push(newRow);
    newRow = [];

  }
  return newGrid;
}

// instrument object
function TBDinstrument(name, rows, cols, type, root){
	this.rows = rows;
	this.cols = cols;
	this.name = name;
  this.type = type;
  this.root = root;
  this.out;
  this.steps = [[],[],[],[]];
  if(type.rows){
    this.rows = type.rows;
  }
  this.grid = [];
  // TODO: delete when we're done fixing up on/off grids
for(i=0;i<4;i++){
  this.grid.push(createGrid(this.rows,cols));
}
this.clear = function(ix){
    this.grid[ix] = createGrid(this.rows,cols);
  }

  this.reversex = function(ix){
    for(i=0;i<this.grid[ix].length;i++){
      this.grid[ix][i].reverse();
      for(j = 0;j<this.grid[ix][i].length;j++){
        if(this.grid[ix][i][j].state === 'on' || this.grid[ix][i][j].state === 'off'){
          this.grid[ix][i][j].state = this.grid[ix][i][j].state === 'on'? 'off':'on';
        }
      }
    }
  }

  this.reversey = function(ix){
    this.grid[ix].reverse();
  }
	// Create the polarity grid for click/unclick

}

function TBDnote(startpos,endpos,data){
  if(data.flipped){
    this.off = startpos;
    this.on = endpos
  }else{
  this.on = startpos;
  this.off = endpos;
  }
  this.data = {
    inst: data.inst,
    grid: data.grid,
    row:data.row
  }
  this.len = Math.abs(endpos - startpos);
  this.row = data.row;
  this.move = function(data){
    this.row = data.row;
    this.on = data.column-data.offset;
    this.off = this.on + this.len;
    this.data.row = data.row;
  }
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
        user: this.messages[i],
        message: this.messages[i+1],
        roomID: this.roomID
      });
    }
  }
}

// activity log object
function log(roomID, timestamp, activity, user, step_size, _id) {
  this.roomID = roomID;
  this.timestamp = timestamp;
  this.activity = activity;
  this.user = user;
  this.step_size = step_size;
  this._id = _id;
}

// check for sessions older than five days, executed on timer
function checkSessionAge() {
  for (i = sessions.length - 1; i >= 0; i --) {
    if (new Date() - sessions[i].created > 86400000 * 5) {
      console.log("Removing " + sessions[i].roomID + ", created at: " + new Date(sessions[i].created));
      createLog(sessions[i].roomID, new Date(), "room removed");
      sessions.splice(i,1);
      rooms.splice(i,1);
      console.log(sessions.length + " sessions remain.")
    }
  }
}

function createLog(roomID, timestamp, activity, user, step_size) {
  var _id = new Date();
  _id = user + roomID + _id.getTime();
  _id = Math.abs(_id.hashCode());

  // create json formatted log
  var newLog = new log(roomID, timestamp, activity, user, step_size, _id)

  // connect to db server
  MongoClient.connect(uri, function(err, client) {
    if(err) throw err;

    const db = client.db(dbName);
    const collection = db.collection('tbd-logs');

    try {
      collection.insertOne(newLog, function(err, result) {
        if(err) throw err;
      });
    } catch (err) {
      console.log("An error occurred accessing the database.");
      console.log(err);
    }

    // clear out logs and close connection if successful
    client.close();
  });
}

function getIx(roomID){
  return rooms.indexOf(roomID);
}

function step(){
  this.state = '';
}

function client(socket, roomID, user) {
  this.client = socket;
  this.roomID = roomID;
  this.user = user;
}

function getClient(id) {
  for (var i=0; i<clients.length; i++) {
    if (clients[i].client.id == id) {
      return i;
    }
  }
}

// extension to string for creating unique IDs
String.prototype.hashCode = function() {
    var hash = 0;
    if (this.length == 0) {
        return hash;
    }
    for (var i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}
