// node modules
var socket = io();

// initialize values
var rootNote = [21,45,69];
var columns = 32;
var userThatClicked = false;
var currentGridIndex = 0;

// Setup
var roomID = -1;
var user = "";
var users = [];
var refreshHistory = 1;
var mousemode = 0;
var counter = 0;
var currentThumb = 0;
var type;
var messageSender;
var columnChanged;
var instruments = [];
var row, column, ix;

// Click Callbacks
var reversing = false;
var clear;
var lastcolumn;
var passedStart;
var columnChanged;
var twoCellsBack;
var lastCellLeft;
var trimLeft, trimRight, trimSingle;
// MIDI
var midiOut;

// Tabs
var lastIx;

//Step related
var move;
var shifted;
var start, $start;
var chord;
var $chord = [[],[]];
var started;

// Draw Loop
var tempo;

var stopcounter=true;

// Instruments
var octave;

// Peristent note index to send delete
var noteIx;

// Notification timeout queue
var timeout_queue = [];

// Setup for the p5 loop
function setup(){
	frameRate(8);
	noLoop();
}
//Start by hidine the container to fade in
$('.container').hide();

// enable WebMIDI
WebMidi.enable(function(err){
	if(err){
		alert("Uh oh! Looks like WebMidi failed. Some browsers don't support WebMIDI, try Firefox or Chrome!!");
	}
	var iacIndex = -1;
	var iac = 'IAC Driver Bus 1';
	// List the outputs
	for(var i = 0; i < WebMidi.outputs.length;i++){
		$('#midi').append("<option>"+WebMidi.outputs[i].name+"</option>")
		if(WebMidi.outputs[i].name.includes(iac)){
			iacIndex = i;
		}
	}
	if(iacIndex > -1){
		midiOut = WebMidi.outputs[iacIndex];
		$('#midi').val(WebMidi.outputs[iacIndex].name);
	}

	$('#midi').val(WebMidi.outputs[iacIndex].name);
	// Sets instrument MIDI outs
	$('#midi').change(function(){
		var selectedOutput = $('option:selected', this).index()-1;
		if(selectedOutput < 0){
			midiOut = 0;
		}else{
			midiOut = WebMidi.outputs[selectedOutput];
		}
		// set output for whole thing
		console.log(midiOut);
	})
})

// page interaction
$(document).ready(function(){
	// check for room joined by url
	var url = window.location.href;

	// case for local vs website
	if (url.includes("www.tbd.zone")) {
		// if a room is appended to base url, join that room
		if (url.replace("http://www.tbd.zone/","") != "") {
			// get the roomID from url string
			roomID = url.replace("http://www.tbd.zone/","")
			roomID = roomID.replace("/", "")

			// send roomID to server for connection
			socket.emit('room', {roomID: roomID});

			// update chat label with roomID
			var chatLabel = "In room: " + roomID;
			$('#chatRoom').text(chatLabel);
		}
	} else {
		// catch all for local network IPs -- take out after testing
		var temp = url.split("").reverse();
		roomID = temp.slice(0,temp.indexOf("/")).reverse().join("");
		console.log(roomID);

		// send roomID to server for connection
		socket.emit('room', {roomID: roomID});

		// update chat label with roomID
		var chatLabel = "In room: " + roomID;
		$('#chatRoom').text(chatLabel);
	}

	// autofill room and pick username if room provided in url
	$('#userPicker').modal('show');
  $('#roomButton').click(function() {
			user = $('#username').val();
			socket.emit('user',
			{
					roomID: roomID,
					user: user
			});
  });

	// get updated list of users after new member joins room
	socket.on('update users', function(data){
		// update user list
		users = data.users;

		// update visual user list
		$('#userList').html('<div class="ital_text">Users</div>');
		for (var i = 0; i < users.length; i++) {
			$('#userList').append('<div class="user" style="background: '+ data.user_colors[i] +'"><div class="user_text">' + users[i] + '</div></div>');
		}

		// determine notification for connection or disconnection
		if (data.type == 'connect') {
			notification(data.user, user, "new_user");
		} else {
			notification(data.user, user, "disconnect");
		}
	});

	// get current grid state from server
	socket.on('joinSession',function(data){
		// update instruments
		if(data.instruments){
			for (var h = 0; h < data.instruments.length;h++){
				var currInst = data.instruments[h];
				instruments.push(new TBDgrid(currInst.name,currInst.rows,currInst.cols,currInst.type,currInst.root,currInst.out));
				for(i = 0; i < 4;i++){
					if(currInst.steps[i].length){
						for(j=0;j<currInst.steps[i].length;j++){
							var currStep = currInst.steps[i][j];
							instruments[h].steps[i].push(new TBDnote(currStep.on,currStep.off,currStep.data));
							instruments[h].getNotes(getLastStep({inst: h,grid: i}));
						}
					}
				}
			}
		}
		$('#tempo').val(data.tempo);
		// frameRate(data.tempo/15);

		// get current list of Users
		users = data.users;

		// show session
		showTab(instruments.length);
		currentGridIndex = instruments.length-1;
		lastIx = currentGridIndex;

		// TODO: set conditions so that it actually reads out when the val is not initialized
		if(!instruments[currentGridIndex].out === null) {
			$('#output').val('Channel '+instruments[currentGridIndex].out);
		}
		// else {
		// 	console.log('we in this');
		// 	$('#output').val('Pick a Channel!');
		// }
		$('.thumbs:eq('+currentGridIndex+')').addClass('selected');
		$('.container').fadeIn(1000);
		// scroll to the middle of the $grid
		$('.gridContainer').scrollTop(400);
	});

	// initial states
	var mouseIsClicked = false;

	// cell click
	// TODO: make it so that this does not effect step move
	$(document).on("mouseleave",'.selected .grid',function(){
		mouseIsClicked = false;
		socket.emit('end grid events',{
			roomID: roomID,
			user: user,
			row: row,
			column: column,
			grid: currentThumb,
			inst: currentGridIndex,
			trimRight: trimRight,
			trimLeft:trimLeft,
		});
	});


	$(document).on("mousedown",'.selected .row .step',function(){
		passedStart = false;
		reversing = false;
		columnChanged = false;
		clear = false;
		lastCellLeft = 0;
		twoCellsBack = -1;

		// Flag for if client is moving a note
		trimRight = alted && $(this).hasClass('right') && !$(this).hasClass('left');
		trimLeft = alted && $(this).hasClass('left') && !$(this).hasClass('right');
		trimSingle = alted && $(this).hasClass('left') && $(this).hasClass('right');
		move = $(this).hasClass('clicked') && !alted ? true : false;
		mouseIsClicked = true;

		row = $(this).parent().index();
		column = $(this).index();

		// Audition notes on click
		var rowNum = instruments[currentGridIndex].rows;
		var note = instruments[currentGridIndex].type.midiNotes[rowNum-1-row]
		if(instruments[currentGridIndex].out && midiOut && note){
			midiOut.playNote(note,instruments[currentGridIndex].out);
			midiOut.stopNote(note,instruments[currentGridIndex].out,{time: '+500'});
		}

		// store mouse starting point
		start = column;

		// set state to the proper mode

		if (move) {
			grabNote();
			$('.grid .selected').addClass('grabbing')
		} else if( trimRight || trimLeft || trimSingle) {
			trimNote();
		} else {
			state = mousemode === 1 ? '' :  'on';
			sendStep(state);
		}

	//Remember previous cell for turning around
	}).on("mouseleave",'.selected .row .step',function(){
			if(mouseIsClicked) {
				// only do this if we have in fact left any cells
				if(lastCellLeft && columnChanged){
					twoCellsBack = lastCellLeft;
				}
				column = $(this).index();
				passedStart = reversing && (column === start) ? true:false;
				if(columnChanged) {
					lastCellLeft=column;
				}
				if(reversing) {
					state = clear || reversing ? '' : 'sus';
					sendStep(state);
				}

			}
		}).on("mouseenter", '.selected .row .step',function(){
		if(mouseIsClicked){
			columnChanged = column === $(this).index() ? false : true;

			if(passedStart){
				//This clears the starting cell when user reverses while drawing
				clear = true;
				reversing = false;
			}
			column = $(this).index();
			if(trimSingle){
				if(column < start){
					trimLeft = true;
					console.log("You're extending left")
				} else if (column > start) {
					trimRight = true;
					console.log("You're extending right")
				}
			}
			if((column === twoCellsBack) && (!move)) {
				reversing = reversing ? false : true;
				//sets cell to off if user goes back from whence he came
				column = lastCellLeft;
				state = reversing ? '' : 'sus';
				sendStep(state);
			}

			if(mousemode === 1) {
				//There are no row limitations on the eraser mode
				row = $(this).parent().index();
				state = '';
				sendStep(state);
			}

			if(move) {
				row = $(this).parent().index();
				sendStep('move');
			} else if (trimLeft || trimRight || trimSingle){
				trimNote();
			}else if(mousemode === 0 || mousemode === 2) {
				column = $(this).index();
				state = clear || reversing ? '' : 'sus';
				sendStep('sus');
			}
		}
	}).on("mouseup",'.row .step',function() {
		if(mouseIsClicked){
		mouseIsClicked = false;
		column = $(this).index();

		if(!shifted && move){
			releaseNote();
		}else if(trimLeft || trimRight || trimSingle){
			setTrim();
		}else{
			sendStep('off');
		}

		reversing = false;
		clear = false;
	}
	});

	// update steps from all users
	socket.on('stepreturn',function(data){
		stepReturn(data);
	});
	// Set up allow for the highlighting and selecting of steps
	$(document).on("mouseover",".step.clicked",function(){
		var $step = $(this);
		var thisCol = $step.index();
//		Searches for the note you're hovering over
		var highlight= instruments[currentGridIndex].steps[currentThumb].findIndex(function(el){
			return (el.row === $step.parent().index()) && (el.on <= thisCol) && (el.off >= thisCol)
		});
		if(highlight > -1){
			instruments[currentGridIndex].steps[currentThumb][highlight].$els.addClass('highlighted');
		}

	}).on("mousedown",".clicked",function(){
			var $step = $(this);
			var thisCol = $step.index();
			if(currentGridIndex > -1){
				noteIx = instruments[currentGridIndex].steps[currentThumb].findIndex(function(el){
					return (el.row === $step.parent().index()) && (el.on <= thisCol) && (el.off >= thisCol)
				});
			}
			$('.selected .row .step').removeClass('selected');

	}).on("mouseleave", ".clicked",function(){
			var $step = $(this);
			var thisCol = $step.index();
			var highlight = instruments[currentGridIndex].steps[currentThumb].findIndex(function(el){
				return (el.row === $step.parent().index()) && (el.on <= thisCol) && (el.off >= thisCol)
			});
			if(highlight > -1){
				instruments[currentGridIndex].steps[currentThumb][highlight].$els.removeClass('highlighted');
			}
	});

	// The tab toggler
	$(document).on("click","ul.tabs li a",function(){
		var tab_id = $(this).attr('data-tab');
		$('ul.tabs li a').removeClass('selected');
		$('.tab-content').removeClass('selected');
		$('.thumbs').removeClass('selected')

		lastIx = currentGridIndex;
		currentGridIndex = $("ul.tabs li a").index(this)-1;

		$(this).addClass('selected');
		$("#"+tab_id+"").addClass('selected');
		$('.thumbs:eq('+currentGridIndex+')').addClass('selected');

		if(!$('.tab-content').hasClass('selected')){
			ix = $('.tab-link').index(this);
			$('.tab-content:eq('+ix+')').addClass('selected')
			$('.thumbs:eq('+currentGridIndex+')').addClass('selected');
		}

		// recall thumb within instrument when user switches
		if(currentGridIndex > -1){
			currentThumb = instruments[currentGridIndex].thumb;
			$('.thumbs .grid').removeClass('selected');
			$('.thumbs:eq('+currentGridIndex+') .grid:eq('+currentThumb+')').addClass('selected');
		}

		// This sets the output so the users knows that output on their current tab...
		if(instruments[currentGridIndex] && currentGridIndex>-1) {
			$('#output').val('Channel '+instruments[currentGridIndex].out);
		} else {
			$('#output').val('Pick yr MIDI out!');
		}

	});

	// update style on '+' button
	$('#plus').mousedown(function(){
		$('.newInstrument').toggleClass("clicked");
	});

	$('.cancel').click(function(){
		$('.newInstrument').toggleClass("clicked");
		$('ul.tabs li a').removeClass('selected');
		$('.tab-content').removeClass('selected');
		$('ul.tabs li a:eq(1)').addClass('selected');
		$('.tab-content:eq(1)').addClass('selected');
	});

	// track shift and alt for alternate click fns
	$(document).on('keyup keydown', function(e){
		shifted = e.shiftKey;
		alted = e.altKey;
	});



	// distribute step delete to server
	$(document).on('keydown', function(e){
		if(e.keyCode === 8 && currentGridIndex > -1){
			if(instruments[currentGridIndex].steps[currentThumb].length){
				sendDelete();
			}
		} else if (e.altKey){
			console.log("alt in progress")
			$('.step.clicked.left').addClass('alted');
			$('.step.clicked.right').addClass('alted');
		}

	}).on('keyup', function(e){
		if (e.which === 18) {
			$('.step').removeClass('alted');
		}
	});


	// receive step delete msg from server
	socket.on('delete step return',function(data){
		deleteNote(data);
		if(instruments[currentGridIndex].steps[currentThumb].length){
			getLastStep(data);
			instruments[data.inst].steps[data.grid][noteIx].select();
		}
	});

	// Presets dropdown: [drums,major,minor,blues,fullGrid,chords]
	$("#presets").change(function(){
		type = $('option:selected', this).index()-1;
		if(type>0){
			$('.preset-extras').show();
			$('.inst').show();
		} else {
			$('.preset-extras').hide();
			$('.inst').show();
		}
	});

	// octave/range on new inst dialog
	$('#octave').change(function(){
		octave = $('option:selected', this).index()-1;
		console.log('which octave ',octave);
	})

	// TODO: do we need this? change?
	// mousemode interaction types
	$('#mousemode').change(function(){
		$('.grid').removeClass('eraser');
		mousemode = $('option:selected', this).index();
		console.log(mousemode)
		$('.grid').removeClass('eraser chord');
		switch(mousemode){
			case 0:
			console.log("Pencil Mode");
			break;
			case 1:
			$('.grid').addClass('eraser');
			break;
			case 2:
			$('.grid').addClass('chord');
			break;
		}
	})

	// MIDI channel output
	$('#output').change(function(){
		$('option:selected', this).index();
		instruments[currentGridIndex].out = $('option:selected', this).index();
	})

	// TODO: Update new instrument dialog
	// create new instance from user menu specs
	$(".newInsButton").click(function(){
		var instName = $("#insName").val();

		var duplicates = true;
		var numToAppend = 1;
		var names = instruments.map(a => a.name);

		// disallow duplicate names
		while(duplicates){
			var dupIx = names.indexOf(instName);
			if(dupIx > -1) {
				if(numToAppend > 1) {
					instName = instName.substring(0,instName.length-1)
				}
				instName = instName + numToAppend;
				numToAppend+=1;
			} else {
				duplicates = false;
			}
		}

		// make instrument with specified number of notes
		var rowCount = 60
		if(rowCount > 128){
			rowCount = 128;
		} else if (rowCount < 1){
			rowCount = 1;
		}
		rowCount = Math.floor(rowCount);

		var thisRoot = octave > -1 ? rootNote[octave] : rootNote[1];
		console.log('rowCount:   ',rowCount);
		rowCount = 128 < (thisRoot + rowCount) ? (128 - thisRoot) : rowCount;
		console.log('thisRoot   ', thisRoot);

		if(!rowCount || type === 0){
			rowCount = 12;
		}
		userThatClicked = true;

		// distribute new instrument details to all users
		socket.emit('newInst',{
			name: instName,
			rows: rowCount,
			type: presets[type],
			roomID: roomID,
			user: user,
			root: thisRoot
		});
	});

	// receive new instrument created by other user
	socket.on('newInstReturn',function(data){
		instruments.push(new TBDgrid(data.name,data.rows,columns,data.type,data.root,data.out));
		if(userThatClicked){
			currentGridIndex = instruments.length-1;
			$('ul.tabs li a').removeClass('selected');
			$('.tab-content').removeClass('selected');
			$('.thumbs').removeClass('selected');
			$('ul.tabs li a:eq('+instruments.length+')').addClass('selected');
			$('.tab-content:eq('+instruments.length+')').addClass('selected');
			$('.thumbs:eq('+(instruments.length-1)+')').addClass('selected');
			currentThumb = instruments[currentGridIndex].thumb;
			userThatClicked = false;
		}

		// notify
		notification(data.user, user, "new_inst");
	});

	// clear grid
	$("#clearcurrent").click(function(){
		socket.emit('clearcurrent',
		{
			inst: currentGridIndex,
			grid: currentThumb,
			roomID: roomID,
			user: user
		});
	});

	// update grid on clear
	socket.on('clearcurrentreturn', function(data){
		console.log(data);
		instruments[data.inst].clear(data.grid);
	});

	// distribute tempo change
	$('#tempo').change(function(){
		tempo = $(this).val()
		socket.emit('tempo',
		{
			tempo: tempo,
			roomID: roomID,
			user: user
		});
	});

	// receive tempo change
	socket.on('temporeturn',function(data){
		$('#tempo').val(data.tempo);
		frameRate(data.tempo/15);
	});

	// start/stop ticker
	$('#startstop').click(function(){
		$(this).toggleClass('started');
		if($(this).hasClass('started')){
			$(this).text('STOP');
			counter = 0;
			stopcounter = false;
			started = true;
			loop();
		} else {
			for (var i = 0; i < instruments.length; i++) {
				if(instruments[i].out && midiOut){
					midiOut.stopNote('all','all')
				}
				$('.step').removeClass('current');
			}
			$(this).text('Start');
			noLoop();
			stopcounter = true;
		}
	});

	// distribute horizontal reverse
	$('#reversex').click(function(){
		socket.emit('reversex',
		{
			inst:currentGridIndex,
			gridix: currentThumb,
			roomID:roomID,
			user: user
		});
	});

	// receive horizontal reverse
	socket.on('reversexreturn',function(data){
		instruments[data.inst].gridReversed(data.grid,data.inst,data.gridix);
		console.log('inst:  ',data.inst);
		console.log('grid:  ', data.grid);
	})

	// distribute vertical reverse
	$('#reversey').click(function(){
		socket.emit('reversey',
		{
			inst:currentGridIndex,
			roomID:roomID,
			gridix: currentThumb,
			user: user
		});
	});

	// receive vertical reverse
	socket.on('reverseyreturn',function(data){
		instruments[data.inst].gridReversed(data.grid,data.inst,data.gridix);
	})

	// change thumb
	$(document).on('click','.grid.little',function(){
		var $gridThumbs = $('.grid.little');
		$gridThumbs.removeClass('selected')
		var $thumb = $(this);

		if(instruments[currentGridIndex].out && midiOut){
			midiOut.stopNote('all',instruments[currentGridIndex].out);
			// TODO: note off messages for instruments with aftertouch
			console.log('Notes should have stopped');
		}

		currentThumb = $thumb.index();
		instruments[currentGridIndex].thumb = currentThumb;
		$('.tab-content.selected .grid').hide();
		$('.tab-content.selected .grid:eq('+currentThumb+')').show();
		$thumb.addClass('selected');
	});

	// send a chat msg via click
	$("#chatSend").click(function(){
		messageSubmit();
	});

	// send a chat msg via ENTER
	$("#chatInput").keypress(function(e){
		// Listen for enter key
		if (e.which == 13){
			// trigger chatSend click
			$("#chatSend").trigger('click');
		}
	});

	// receive msg and update list
	socket.on('chat to client', function(data){
			// update message list
			refreshHistory = 0;
			$('.messages').append($('<li>').html('<i>' + data.user + ": " + '</i>' + data.message));

			// notify
			notification(data.user, user, "msg");
	});

	// update chat history for new connection
	socket.on('chat history', function(data){
		if (refreshHistory) {
			$('.messages').append($('<li>').html('<i>' + data.user + ": " + '</i>' + data.message));
		}
	});

	// delete an instrument tab
	$(document).on('click','.deletetab',function(){
		var tab2delete = $('.deletetab').index(this);
		socket.emit('deletetab',
		{
			tab2delete: tab2delete,
			roomID: roomID,
			user: user
		});
	});

	// receive deleted instrument message
	socket.on('deletereturn',function(data){
		ix = data.tab2delete+1;
		$('.tab-link:eq('+ix+')').parent().remove();
		$('.tab-content:eq('+ix+')').remove();
		$('.thumbs:eq('+(ix-1)+')').remove();

		var needsToToggle= lastIx >= ix-1 ? true:false;
		ix-=1;
		instruments.splice(ix,1);

		// shift user position if underlying tab indexes
		if(needsToToggle){
			if(lastIx === 0){
				lastIx = 1;
			}

			// update tab style
			$('.tab-link:eq('+(lastIx)+')').addClass('selected');
			$('.tab-content:eq('+(lastIx)+')').addClass('selected');
			$('.thumbs:eq('+(lastIx-1)+')').addClass('selected');

			currentGridIndex = lastIx - 1;
		} else {
			// update tab style
			$('.tab-link:eq('+(lastIx+1)+')').addClass('selected');
			$('.tab-content:eq('+(lastIx+1)+')').addClass('selected');
			$('.thumbs:eq('+(lastIx)+')').addClass('selected');

			currentGridIndex = lastIx;
		}

		// notify
		notification(data.user, user, "delete_inst");
	});

	// audition notes by clicking on row labels
	$(document).on('mousedown','.rowlabel',function(){
		var note = $(this).index();
		var rowNum = instruments[currentGridIndex].rows;
		note = instruments[currentGridIndex].type.midiNotes[rowNum-1-note]
		if(instruments[currentGridIndex].out && midiOut){
			midiOut.playNote(note, instruments[currentGridIndex].out);
			midiOut.stopNote(note, instruments[currentGridIndex].out, {time: '+500'});
		}
	});
});

// draw loop for p5 clock
function draw() {
	if (started) {
		counter = 0;
		started = false;
	} else {
		counter += 1;
		counter = counter % columns;
	}

	// play notes when ticker moves through columns
	for (i=0; i<instruments.length; i++) {
		var currThumb = instruments[i].thumb;
		if (instruments[i].out && midiOut && instruments[i].notes.off[currThumb][counter]) {
			midiOut.stopNote(instruments[i].notes.off[currThumb][counter], instruments[i].out);
		}
		if (instruments[i].out && midiOut && instruments[i].notes.on[currThumb][counter]) {
			midiOut.playNote(instruments[i].notes.on[currThumb][counter], instruments[i].out);
		}
	}
	// move ticker
	$('.step').removeClass('current');

	// highlight next column for ticker
	if (!stopcounter) {
		var allRows = $('.step:eq('+counter+')', '.row').addClass('current');
	} else {
		// error case if MIDI output is not configured
		midiOut ? midiOut.stopNote('all'): console.error("You haven't set the MIDI out!");
		$('.step').removeClass('current');
	}
}

$('.step').removeClass('current');
// message submit and tag search fn def
function messageSubmit() {
	// username
	var user = $('#username').val();
	// message
	var message = $('#chatInput').val()

	// sent plain chat to server
	socket.emit('chat to server',
	{
		user: user,
		message: message,
		roomID: roomID
	});

  $('#chatInput').val('');
}

function showTab(index){
	$('ul.tabs li a').removeClass('selected');
	$('.tab-content').removeClass('selected');
	$('ul.tabs li a:eq('+index+')').addClass('selected');
	$('.tab-content:eq('+index+')').addClass('selected');
}

function stepReturn(data){
	// each step and thumb received are saved as jQuery
	// for real-time visual updating of all user interactions
	var $step = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+")  .row:eq("+data.row+") .step:eq("+data.column+")");
	var $stepthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb:eq("+data.column+")");

	// check for interaction mode


	// step interaction
	switch(data.state) {
		// clear a note
		case '':
			$step.removeClass('clicked left right');
			$stepthumb.removeClass('clicked');
			break;

		// user clicked to start a note
		case 'on':
			$step.addClass('clicked');

			$start = $step;
			if(data.mousemode == 2){
				$chord[0].push($step);
			}
			$stepthumb.addClass('clicked');
			break;

		// single note
		case 'onoff':
			$step.addClass('clicked left right');
			$stepthumb.addClass('clicked');

			instruments[data.inst].steps[data.grid].push(new TBDnote($step.index(),$step.index(),data));
			instruments[data.inst].getNotes(getLastStep(data));
			if(data.mousemode === 2){
				$chord = [[],[]];
			}
			break;

		// sustaining note
		case 'sus':
			$step.removeClass('left right');
			$step.addClass('clicked');
			$stepthumb.addClass('clicked');
			break;

		// moving steps
		case 'move':
			// get offset of click location from note on
			data.column -= data.offset;
			if (data.grab) {
				var movingStep = instruments[data.inst].steps[data.grid][data.noteIx]
				instruments[data.inst].removeNotes(movingStep);
				instruments[data.inst].steps[data.grid][data.noteIx].clearBorder();
			}
			instruments[data.inst].steps[data.grid][data.noteIx].move(data);

			// refresh jQuery to reflect instrument state on server
			instruments[data.inst].refreshSteps(data.grid);

			// complete note on mouseup
			if(data.release) {
				// remove all prior styling
				$('.step').removeClass('grabbing');
				var setNote = instruments[data.inst].steps[data.grid][data.noteIx];
				instruments[data.inst].steps[data.grid][data.noteIx].updateUser(data.user);
				// check for overlapped steps in final step position
				var overlappers = instruments[data.inst].steps[data.grid].filter(a =>
					a.inRange(setNote.on,setNote.off) && (a.row === data.row));

				// remove reference to the note that we're checking against
				overlappers.splice(overlappers.indexOf(setNote),1);

				// cases for different overlap situations
				var overlapTypes = [];
				overlappers.forEach(a => overlapTypes.push(overlapType(setNote, a)))
				correctOverlaps(overlappers, overlapTypes, setNote,data);

				// update new changes visually
				instruments[data.inst].refreshSteps(data.grid);
				instruments[data.inst].getNotes(setNote);
			}
			break;
		case 'trim':
			var currNote = instruments[data.inst].steps[data.grid][data.noteIx];
			instruments[data.inst].removeNotes(currNote);
			instruments[data.inst].steps[data.grid][data.noteIx].clearBorder();
			if(data.trimLeft){
				instruments[data.inst].steps[data.grid][data.noteIx].trimLeft(data.column,data)
			}else if(data.trimRight){
				instruments[data.inst].steps[data.grid][data.noteIx].trimRight(data.column,data);
			}


			if(data.delete){
				deleteNote(data);
			}else{
				instruments[data.inst].getNotes(currNote);

				instruments[data.inst].steps[data.grid][data.noteIx].updateUser(data.user);
				resolveOverlaps(currNote,data);
			}
			break;

		// note is finalized on mouseup
		case 'off':
			// TODO: update chord interaction for new step object
			if(data.mousemode == 2){
				$chord[1].push($step);
			}
			// check for drag direction (L->R, R->L)
			if(data.flipped){
					$end = $start;
					$start = $step;

			} else {
				$end = $step;

			}

			// put created note into array of active notes
			if (data.mousemode != 2) {
				if ($start) {
					$start.addClass('left clicked');
					instruments[data.inst].update($start,data.grid);
				}
				if ($end) {
					$end.addClass('right clicked');
				}

				// create new note object instance
				instruments[data.inst].steps[data.grid].push(new TBDnote($start.index(),$end.index(),data));

				instruments[data.inst].getNotes(getLastStep(data));
			}
			break;
	}
}

function TBDnote(startpos,endpos,data) {
	// start, end, length
	this.on = startpos;
	this.off = endpos;
	this.len = endpos - startpos;
	// instrument of note
	this.grid = data.grid;
	// row of note
	this.row = data.row;
	this.user = data.user;
	var color = "blue";


	// jQuery reference for starting and ending elements
	this.$start = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+startpos+")");
	this.$end = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+endpos+")");

	// Combine of the html elements in the step
	this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);

	// Combine all of the html elements in the thumb step
	this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);

	//Add classes for appropriate styling
	this.$els.addClass('clicked');
	this.$els.removeClass('left right');
	this.$elsthumb.addClass('clicked');
	this.$end.addClass('right');
	this.$start.addClass('left');
	this.$els.css('border-top', 'solid ' + color + ' 2px');
	this.$els.css('border-bottom', 'solid ' + color + ' 2px');
	this.$start.css('border-left', 'solid ' + color + ' 2px')
	this.$end.css('border-right', 'solid ' + color + ' 2px')

	this.updateUser = function(user){
		// find associated color
		this.user = user;
		var color = "blue";
		this.$els.css('border-top', 'solid ' + color + ' 2px');
		this.$els.css('border-bottom', 'solid ' + color + ' 2px');
		this.$start.css('border-left', 'solid ' + color + ' 2px')
		this.$end.css('border-right', 'solid ' + color + ' 2px')
	}



	this.clearBorder = function(){
		this.$els.css('border-top', '');
		this.$els.css('border-bottom', '');
		this.$start.css('border-left', '')
		this.$end.css('border-right', '')

	}
	this.move = function(data) {
		// clear styling for previous step location
		this.$els.removeClass('left right clicked selected')
		this.$elsthumb.removeClass('clicked');

		// reset new location
		this.row = data.row;
		this.on = data.column;

		// edge case to shorten note at grid boundaries
		if (this.on<0) {
			this.on = 0;
		}
		this.off = data.column + this.len;
		if (this.off > 31) {
			this.off = 31;
		}

		// Reset the jquery to refer to the moved location
		this.$start = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+this.on+")");
		this.$end = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(this.off)+")");

		this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);
		this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);

		this.$start.addClass('left');
		this.$end.addClass('right');

		this.$els.addClass('clicked selected grabbing');
		this.$elsthumb.addClass('clicked');
	}

	// check for element overlapping another by reference points
	this.inRange = function(on, off) {
		var isOverlapping = between(on,off,this.on) || between(on,off,this.off);
		var isWrapped = between(this.on,this.off,on) || between(this.on,this.off,off)
		return isOverlapping || isWrapped;
	}

	// this.userLeft = function(user){
	// 	if(this.user === user){
	//
	// 	}
	// }

	// update styling as note is moved
	this.update = function() {
		this.$els.addClass('clicked').removeClass('highlighted');
		this.$start.addClass('left');
		this.$end.addClass('right');
		this.$elsthumb.addClass('clicked');
	}

	// remove all styling before deleting a note
	this.delete = function() {
		this.$els.removeClass('clicked left right highlighted selected');
		this.$elsthumb.removeClass('clicked');
	}

	// select note for moving
	this.select = function() {
		this.$els.addClass('clicked selected');
	}

	// trim note at note on - left grid boundary
	this.trimLeft = function(newOn, data) {
		this.$els.removeClass('clicked left highlighted selected')
		this.$elsthumb.removeClass('clicked');
		this.on = newOn;
		this.len = this.off - this.on;

		// Reset the jquery to refer to the moved location
		this.$start = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+this.on+")");
		this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);
		this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);
		this.$els.addClass('clicked selected');
		this.$start.addClass('left');
		this.$elsthumb.addClass('clicked');
	}

	// trim note at note off - right grid boundary
	this.trimRight = function(newOff, data) {
		this.$els.removeClass('clicked right highlighted selected')
		this.$elsthumb.removeClass('clicked');
		this.off = newOff;
		this.len = this.off - this.on;

		// Reset the jquery to refer to the moved location
		this.$end = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(this.off)+")");
		this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);
		this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);
		this.$els.addClass('clicked selected');
		this.$end.addClass('right');
		this.$elsthumb.addClass('clicked');
	}
}

// send step to server
function sendStep(state) {
	socket.emit('step',{
		row: row,
		column: column,
		inst: currentGridIndex,
		roomID: roomID,
		mousemode: mousemode,
		user: user,
		shifted: shifted,
		state: state,
		grid: currentThumb,
	});
}

// grab note to move
function grabNote() {
	socket.emit('step',{
		row: row,
		column: column,
		inst: currentGridIndex,
		roomID: roomID,
		mousemode: mousemode,
		user: user,
		shifted: shifted,
		state: 'move',
		grid: currentThumb,
		grab: true,
	});
}

// drop note after moving
function releaseNote() {
	socket.emit('step',{
		row: row,
		column: column,
		inst: currentGridIndex,
		roomID: roomID,
		mousemode: mousemode,
		user: user,
		shifted: shifted,
		state: 'move',
		grid: currentThumb,
		release: true,
	});
}

function trimNote(){
	socket.emit('step',{
		row: row,
		column: column,
		inst: currentGridIndex,
		roomID: roomID,
		mousemode: mousemode,
		user: user,
		shifted: shifted,
		state: 'trim',
		grid: currentThumb,
		trimLeft: trimLeft,
		trimRight: trimRight,
	});
}

function setTrim(){
	socket.emit('step',{
			row: row,
			column: column,
			inst: currentGridIndex,
			roomID: roomID,
			mousemode: mousemode,
			user: user,
			shifted: shifted,
			state: 'trim',
			grid: currentThumb,
			trimLeft: trimLeft,
			trimRight: trimRight,
			release:true,
	})
}

// distribute deleted step message
function sendDelete() {
	socket.emit('delete step',{
		inst: currentGridIndex,
		grid: currentThumb,
		noteIx: noteIx,
		roomID: roomID,
		user: user,
	});
}

// delete note
function deleteNote(data) {
	instruments[data.inst].removeNotes(instruments[data.inst].steps[data.grid][data.noteIx]);
	instruments[data.inst].steps[data.grid][data.noteIx].delete();
	instruments[data.inst].steps[data.grid].splice(data.noteIx, 1);
}

// TODO: update chord stuff for new step obj
function chordUpdate($chord, data) {
	$chord[0].forEach(function(element){
		element.removeClass('right');
		element.addClass('left clicked')
	})

	$chord[1].forEach(function(element){
		element.removeClass('left');
		element.addClass('right clicked');
	})

	for(var i = 0; i < $chord[0].length;i++){
		instruments[data.inst].update($chord[0][i],data.grid);
		instruments[data.inst].update($chord[1][i],data.grid);
	}
}

// retrieve last step in array to select newly created note
function getLastStep(data) {
	noteIx = instruments[data.inst].steps[data.grid].length;
	noteIx -= 1;
	var thisStep = instruments[data.inst].steps[data.grid][noteIx];
	return thisStep;
}

// check if a note falls within another note
function between(lower, upper, check) {
	if (check >= lower && check <= upper) {
		return true;
	} else {
		return false;
	}
}

// differentiate between overlap situations
function overlapType(moved, overlap) {
	if (between(moved.on, moved.off, overlap.off) && between(moved.on,moved.off, overlap.on)) {
		return 'covered'
	} else if (!between(moved.on, moved.off, overlap.off) && !between(moved.on,moved.off, overlap.on)) {
		return 'wrapping'
	} else if (between(moved.on, moved.off, overlap.off) && overlap.on < moved.on) {
		return 'onleft';
	} else {
		return 'onright';
	}
}

// update styling based on overlap type
function correctOverlaps(overlaps, overlapCase, moved, data) {
	for (i=0; i<overlaps.length; i++) {
		var currIx = instruments[data.inst].steps[data.grid].indexOf(overlaps[i]);

		// apply overlap types
		switch (overlapCase[i]) {
			//Working properly
			case 'covered':
				data.noteIx = currIx;
				deleteNote(data);
				break;

				//Working properly
			case 'wrapping':
				instruments[data.inst].steps[data.grid].push(new TBDnote(moved.off+1,overlaps[i].off,data));
				instruments[data.inst].getNotes(getLastStep(data));
				instruments[data.inst].steps[data.grid][currIx].trimRight(moved.on-1,data);
				break;


			case 'onleft':
				var currNote = instruments[data.inst].steps[data.grid][currIx]
				instruments[data.inst].removeNotes(currNote);
				instruments[data.inst].steps[data.grid][currIx].trimRight(moved.on-1,data);
				instruments[data.inst].getNotes(currNote);
				break;


			case 'onright':
				var currNote = instruments[data.inst].steps[data.grid][currIx]
				instruments[data.inst].removeNotes(currNote);
				instruments[data.inst].steps[data.grid][currIx].trimLeft(moved.off+1,data);
				instruments[data.inst].getNotes(currNote);
				break;
		}
	}
}


function resolveOverlaps(currentStep, data){
	var overlappers = instruments[data.inst].steps[data.grid].filter(a =>
		a.inRange(currentStep.on,currentStep.off) && (a.row === data.row));

	// remove reference to the note that we're checking against
	overlappers.splice(overlappers.indexOf(currentStep),1);

	// cases for different overlap situations
	var overlapTypes = [];
	overlappers.forEach(a => overlapTypes.push(overlapType(currentStep, a)))
	correctOverlaps(overlappers, overlapTypes, currentStep,data);

	// update new changes visually
	instruments[data.inst].refreshSteps(data.grid);
	instruments[data.inst].getNotes(currentStep);
}

// notification function
function notification(sender, user, type) {
	// clear old timeouts
	for (var i = timeout_queue.length-1; i >= 0; i--) {
		clearTimeout(timeout_queue[i]);
		timeout_queue.splice(i, 1);
	}

	// only notify if other user initiates action
	if (sender != user) {
		// parse type
		var notification = "";
		switch (type) {
			case "msg":
				notification = sender + " sent a message."
				break;
			case "new_inst":
				notification = sender + " created a new instrument."
				break;
			case "delete_inst":
				notification = sender + " deleted an instrument."
				break;
			case "disconnect":
				notification = sender + " left the room."
				break;
			case "new_user":
				notification = sender + " joined the room."
				break;
		}

		// show notification with appropriate type
		$('.notif').fadeIn();
		$('.notif_text').fadeIn();
		$('.notif_text').html(notification);

		// close and clear notificaiton after six seconds
		var timeout_id = setTimeout(function(){
			$('.notif').fadeOut();
			$('.notif_text').fadeOut();
			$('.notif_text').html("");
		}, 6000);

		// add timeout to queue
		timeout_queue.push(timeout_id);
	}
}
