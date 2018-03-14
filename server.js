var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var normalizeSocket = require("normalize-port");
var port = normalizeSocket(process.env.PORT || "8081");
const MongoClient = require('mongodb').MongoClient;
const uri = 'mongodb://heroku_wzrt98pf:o60ajjk1lrsa5d23ohlf7auoes@ds117888.mlab.com:17888/heroku_wzrt98pf';
const dbName = 'heroku_wzrt98pf';

// allocate mem for instruments
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
// step vars
var selectedStep,clickOffset;
var selectedSteps = [];
var userThatClicked = [];

app.use(express.static('public'));

// homepage
app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html');
});

// setup page
app.get('/setup', function(req, res){
  res.sendFile(__dirname + '/public/setup.html');
});

// dynamic url for rooms
app.get('/:dynamicroute', function(req,res) {
  res.sendFile(__dirname + '/public/app.html');
});

// check every five minutes for cleaning up old rooms, update db logs
setInterval(function() {
  console.log("Checking for timed-out sessions at current time ", new Date());
  createLog("", new Date(), "checked session ages");
  checkSessionAge();
}, 300000);

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
    if (roomID.includes("ableton-") || roomID.includes("flstudio-") || roomID.includes("reaper-")) {
      var daw = true;
    }
    // retrieve existing session
    if (roomIndex > -1) {
        sessions[roomIndex].onConnection(socket);
        console.log('We found ',roomID);
        createLog(roomID, new Date(), "room accessed");
    // start new session
    } else {
      rooms.push(roomID);
      console.log('Creating ', roomID);

      // start regular session
      if (!daw) {
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
      // start DAW session
      } else {
        roomIndex = sessions.push(new session(roomID,socket));
        roomIndex -= 1;
        // drums
        sessions[roomIndex].instruments.push(new TBDinstrument('drums',12,32,{
          midiNotes: [36,38,40,39,42,44,46,47,45,49,51,56],
          labels:['kick','snare','snare2','clap','closed hat','pedal hat','open hat','mid tom','low tom','crash','ride','bell'],
          rows: 12,
          melodic: 0
        },60,1));
        // bass
        sessions[roomIndex].instruments.push(new TBDinstrument('bass',12,32,{
          midiNotes: [],
        	scale: [0,1,2,3,4,5,6,7,8,9,10,11],
        	labels: [],
        	rows: 0,
        	melodic: 1
        },60,2));
        // arp
        sessions[roomIndex].instruments.push(new TBDinstrument('arp',12,32,{
          midiNotes: [],
        	scale: [0,1,2,3,4,5,6,7,8,9,10,11],
        	labels: [],
        	rows: 0,
        	melodic: 1
        },60,3));
        // pad
        sessions[roomIndex].instruments.push(new TBDinstrument('pad',12,32,{
          midiNotes: [],
        	scale: [0,1,2,3,4,5,6,7,8,9,10,11],
        	labels: [],
        	rows: 0,
        	melodic: 1
        },60, 4));

        sessions[roomIndex].onConnection(socket);
      }
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

  // distribute user step changes
  var offix;
  socket.on('step', function(data) {
    // reset states
    data.onleft = false;
    data.onright = false;

    // erase notes
    if(data.mousemode === 1){
      data.state = '';
    }

    // create single notes when user holds down shift
    data.state = data.shifted ? 'onoff':data.state;

    // if note is a single step, create the note
    if(data.state === 'onoff'){
      sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].push(new TBDnote(data.column,data.column,data));
    }

    // check that user cannot send consecutive 'on' messages
    if(data.state === 'on'){
      doubleCheck = userThatClicked.indexOf(data.user);
      if(doubleCheck > -1){
        userThatClicked.splice(doubleCheck,1);
        start.splice(doubleCheck,1);
      }
      userThatClicked.push(data.user);
      start.push(data.column);
    }

    // finish note on mouseup
    if (data.state === 'off') {
      offix = userThatClicked.indexOf(data.user);
      if (data.column === start[offix]) {
        data.state = 'onoff';
      } else {
        data.flipped = data.column < start[offix] ? true : false;
      }
      sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].push(new TBDnote(start[offix],data.column,data));

      // log event
      createLog(data.roomID, new Date(), "step change", data.user, Math.abs(start[offix] - data.column)+1, data.inst);

      // clean up
      userThatClicked.splice(offix,1);
      start.splice(offix,1);
    }

    // drag an existing note to new location
    if (data.state === 'move') {
      // calculate offset from click location to start of note for dragging and repositioning
      if (data.grab) {
        selectedStep = sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].findIndex(function(el){
          return (el.row === data.row) && (el.on <= data.column) && (el.off >= data.column)
        });
        if (selectedStep > -1) {
          clickOffset = data.column - sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][selectedStep].on;
        }
        // push to array of selected steps
        selectedSteps.push({
          user: data.user,
          offset:clickOffset,
          noteIx: selectedStep,
        });
        data.offset = clickOffset;
      }

      // filter for steps initiated by current user (to prevent confusion with simultaneous step dragging)
      var curr = selectedSteps.filter(a => a.user === data.user)[0];
      if (curr.noteIx > -1) {
        data.offset = curr.offset;
        sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][curr.noteIx].move(data);
        data.noteIx = curr.noteIx;
      }

      // on release, set note at new location
      if (data.release) {
        selectedSteps.splice(selectedSteps.findIndex(a =>a.user === data.user),1)

        // get reference to moved note and check for overlap case
        var setNote = sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][data.noteIx];
				var overlappers = sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].filter(
					a => a.row === data.row && a.inRange(setNote.on,setNote.off));

				//remove reference to the note that we're checking against
				overlappers.splice(overlappers.indexOf(setNote),1);

        // check overlap situation and visually correct
        var overlapTypes = [];
				overlappers.forEach(a => overlapTypes.push(overlapType(setNote,a)))
				correctOverlaps(overlappers,overlapTypes, setNote,data);
      }
    }

    // TODO: update with chord changes
    // chord step interaction
    if (data.mousemode === 2) {
      for (i=0;i<3;i++) {
        if (data.row >= 0) {
          if (data.flipped) {
            sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column].state = 'on';
          } else {
          sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column].state = data.state;
          }

          if (data.onleft && i) {
            var left = sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state;
            switch (left) {
              case 'sus':
                sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state = 'off';
                break;
              case 'on':
                sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column-1].state = 'onoff';
                break;
            }
          }

          if (data.onright && i) {
            var right = sessions[getIx(data.roomID)].instruments[data.inst].grid[data.grid][data.row][data.column+1].state;
            switch (right) {
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
      createLog(data.roomID, new Date(), "step chord", data.user);

      // set to clear if erasing
    } else if (data.mousemode === 1) {
      data.state = '';
      io.to(data.roomID).emit('stepreturn', data);
      createLog(data.roomID, new Date(), "step erased", data.user);

      // sets to 'onoff' when holding shift
    } else {
      if(data.shifted){
        data.state = 'onoff';
      }
      io.to(data.roomID).emit('stepreturn', data);
    }
  });

  // distribute delete setp msg
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
    io.to(data.roomID).emit('deletereturn',data);
    createLog(data.roomID, new Date(), "deleted isntrument", data.user);
  })

  // clear grid contents
  socket.on('clearcurrent', function(data){
    // clear current grid state
    sessions[getIx(data.roomID)].instruments[data.inst].clear(data.grid);
    // send clear message to clients
    io.emit('clearcurrentreturn',data);
    createLog(data.roomID, new Date(), "grid cleared", data.user);
  });

  // update tempo for all users
  socket.on('tempo', function(data){
    sessions[getIx(data.roomID)].tempo = data.tempo;
    io.to(data.roomID).emit('temporeturn', data);
    createLog(data.roomID, new Date(), "tempo changed", data.user);
  })

  // horizontal reverse to all users
  socket.on('reversex',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversex(data.gridix);
    io.to(data.roomID).emit('reversexreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid[data.gridix],
      gridix: data.gridix,
    });
    createLog(data.roomID, new Date(), "x axis reversed", data.user);
  });

  // vertical reverse
  socket.on('reversey',function(data){
    sessions[getIx(data.roomID)].instruments[data.inst].reversey(data.gridix);
    io.to(data.roomID).emit('reverseyreturn',
    {
      inst:data.inst,
      grid:sessions[getIx(data.roomID)].instruments[data.inst].grid[data.gridix],
      gridix: data.gridix,
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
});

// local server connection
http.listen(port, function(){
  console.log('listening on *:', port);
});

// instrument object
function TBDinstrument(name, rows, cols, type, root, out){
	this.rows = rows;
	this.cols = cols;
	this.name = name;
  this.type = type;
  this.root = root;
  this.out = out;
  this.steps = [[],[],[],[]];
  // enable default row number
  if (type.rows) {
    this.rows = type.rows;
  }
  this.clear = function(ix){
    this.steps[ix] = [];
  }
}

// note object
function TBDnote(startpos, endpos, data) {
  // checks direction of note drawing (L->R, R->L)
  if (data.flipped) {
    this.off = startpos;
    this.on = endpos
  } else {
    this.on = startpos;
    this.off = endpos;
  }

  // create JSON for update new users of this instance
  this.data = {
    inst: data.inst,
    grid: data.grid,
    row:data.row
  }

  // calculate and assing position
  this.len = Math.abs(endpos - startpos);
  this.row = data.row;

  // dragging an existing note
  this.move = function(data){
    this.row = data.row;
    this.on = data.column-data.offset;

    // prevent dragging out of bounds to the left
    if (this.on<0) {
      this.on = 0;
    }

    // find note endpoint
    this.off = this.on + this.len;

    // prevent dragging out of bounds to the right
    if(this.off > 31){
      this.off = 31;
    }

    this.data.row = data.row;
  }

  // expand/contract note to right side
  this.trimRight = function(newOff) {
    this.off = newOff;
    this.len = this.off-this.on;
  }

  // expand/contract note to left side
  this.trimLeft = function(newOn) {
    this.on = newOn;
    this.len = this.off-newOn;
  }

  // check for overlapping notes
  this.inRange = function(on,off) {
    var isOverlapping = between(on,off,this.on) || between(on,off,this.off);
    var isWrapped = between(this.on,this.off,on) || between(this.on,this.off,off)
    return isOverlapping || isWrapped;
  }
}

// check for a note that falls completely in the middle of another note
function between(lower, upper, check) {
	if (check >= lower && check <= upper) {
		return true;
	} else {
		return false;
	}
}

// determine overlap type for moved note
function overlapType(moved, overlap){
	if (between(moved.on, moved.off, overlap.off) && between(moved.on, moved.off, overlap.on)) {
		return 'covered';
	} else if (!between(moved.on, moved.off, overlap.off) && !between(moved.on, moved.off, overlap.on)) {
		return 'wrapping';
	} else if (between(moved.on, moved.off, overlap.off) && overlap.on < moved.on) {
		return 'onleft';
	} else {
		return 'onright';
	}
}

// visually adjust overlapped note based on case
function correctOverlaps(overlaps, overlapCase, moved, data) {
	for (i=0; i<overlaps.length; i++) {
		var currIx = sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].indexOf(overlaps[i]);
		switch(overlapCase[i]){
			case 'covered':
				sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].splice(currIx,1);
			  break;

			case 'wrapping':
        sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid].push(new TBDnote(moved.off+1,overlaps[i].off,data));
        sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][currIx].trimRight(moved.on-1);
        break;

			case 'onleft':
			  sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][currIx].trimRight(moved.on-1);
			  break;

      case 'onright':
				sessions[getIx(data.roomID)].instruments[data.inst].steps[data.grid][currIx].trimLeft(moved.off+1);
			  break;
		}
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
        roomID: this.roomID,
      });
    }
  }
}

// activity log object
function log(roomID, timestamp, activity, user, step_size, instrument, _id) {
  this.roomID = roomID;
  this.timestamp = timestamp;
  this.activity = activity;
  this.user = user;
  this.step_size = step_size;
  this.instrument = instrument;
  this._id = _id;
}

// check for sessions older than five days, executed on timer
function checkSessionAge() {
  for (i = sessions.length - 1; i >= 0; i --) {
    if (new Date() - sessions[i].created > 86400000 * 5) {
      console.log("Removing " + sessions[i].roomID + ", created at: " + new Date(sessions[i].created));
      createLog(sessions[i].roomID, new Date(), "room removed");
      sessions.splice(i, 1);
      rooms.splice(i, 1);
      console.log(sessions.length + " sessions remain.")
    }
  }
  console.log("All sessions checked. " + sessions.length + " sessions remain.")
}

// create mongodb log
function createLog(roomID, timestamp, activity, user, step_size, instrument) {
  var _id = new Date();
  _id = user + roomID + _id.getTime();
  _id = Math.abs(_id.hashCode());

  // create json formatted log
  var newLog = new log(roomID, timestamp, activity, user, step_size, instrument, _id)

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

// find room index from rooms array
function getIx(roomID){
  return rooms.indexOf(roomID);
}

// unique client object - user, room, and socket unique ID
function client(socket, roomID, user) {
  this.client = socket;
  this.roomID = roomID;
  this.user = user;
}

// find client in client array
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
        hash = hash & hash;
    }
    return hash;
}
