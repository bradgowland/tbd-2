// node modules
var socket = io();

// initialize values
var rootNote = [21,45,69];
// var rootNote = 45;
var row, column, objGrid, lastCellLeft, twoCellsBack, tempo, ix, columnChanged;

var columns = 32;
var userThatClicked = false;
var currentGridIndex = 0;var lastIx;
var counter = 0;
var currentThumb = 0;
var tempo, messageSender;
var columnChanged;
var allRows,selectedOutput,searchIx,type;
var instruments = [];
var mousemode = 0;
var reversing = false;
var beatDuration = 500;
var roomID = -1;
var user = "";
var users = [];
var currInst;
var refreshHistory = 1;
var shifted;
var start, $start;
var clear;
var lastcolumn;
var passedStart;
var chord; var $chord = [[],[]];
var started;
var stopcounter;
var octave, offset;
var move;
var midiOut;
var noteIx;
var grabbing = false;
function setup(){
	frameRate(8);
	noLoop();
}
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
		selectedOutput = $('option:selected', this).index()-1;
		if(selectedOutput < 0){
			midiOut = 0;
		}else{
			midiOut = WebMidi.outputs[selectedOutput];
		}
		// set output for whole thing
		console.log(midiOut);
	});
});

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
		users = data.users;
	});

	// get current grid state from server
	socket.on('joinSession',function(data){
		// update instruments
		if(data.instruments){
			for (var h = 0; h < data.instruments.length;h++){
				currInst = data.instruments[h];
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
		frameRate(data.tempo/15);

		// get current list of Users
		users = data.users;

		// show session
		showTab(instruments.length);
		currentGridIndex = instruments.length-1;
		lastIx = currentGridIndex;
		if(instruments[currentGridIndex] && currentGridIndex>-1) {
			$('#output').val('Channel '+instruments[currentGridIndex].out);
		} else {
			$('#output').val('Pick yr MIDI out!');
		}
		$('.thumbs:eq('+currentGridIndex+')').addClass('selected');
		$('.container').fadeIn(1000);
		$('.gridContainer').scrollTop(400);
	});

	// initial states
	var mouseIsClicked = false;

	// cell click
	$(document).on("mouseleave",'.selected .grid',function(){
		mouseIsClicked = false;
	});

	$(document).on("mousedown",'.selected .row .step',function(){
		// Sets whether pencil will be erasing or drawing
		passedStart = false;
		reversing = false;
		columnChanged = false;
		clear = false;
		lastCellLeft = 0;
		twoCellsBack = -1;

		// Flag for if client is moving a note
		move = $(this).hasClass('clicked') ? true : false;
		mouseIsClicked = true;

		row = $(this).parent().index();
		column = $(this).index();

		// Audition notes on click
		var rowNum = instruments[currentGridIndex].rows;
		var note = instruments[currentGridIndex].type.midiNotes[rowNum-1-row]
		if(instruments[currentGridIndex].out && midiOut && note && stopcounter && !clear){
			midiOut.playNote(note,instruments[currentGridIndex].out);
			midiOut.stopNote(note,instruments[currentGridIndex].out,{time: '+500'});
		}

		// store mouse starting point
		start = column;

		// set state to the proper mode
		if(move) {
			grabNote();
			$('.grid .selected').addClass('grabbing')
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
			} else if(mousemode === 0 || mousemode === 2) {
				column = $(this).index();
				state = clear || reversing ? '' : 'sus';
				sendStep('sus');
			}
		}
	}).on("mouseup",'.row .step',function() {
		mouseIsClicked = false;
		column = $(this).index();

		if(!shifted){
			move ? releaseNote() : sendStep('off');
		}

		reversing = false;
		clear = false;
	});

	// update steps from all users
	socket.on('stepreturn',function(data){
		stepReturn(data);
	});

	$(document).on("mouseover",".step.clicked",function(){
		var $step = $(this);
		var thisCol = $step.index();
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

	$(document).on('keyup keydown', function(e){
		shifted = e.shiftKey;
		alted = e.altKey;
	});

	$(document).on('keydown', function(e){
		if(e.keyCode === 8 && currentGridIndex > -1){
			if(instruments[currentGridIndex].steps[currentThumb].length){
				sendDelete();
			}
		}
	});

	socket.on('delete step return',function(data){
		deleteNote(data);
		if(instruments[currentGridIndex].steps[currentThumb].length){
			getLastStep(data);
			instruments[data.inst].steps[data.grid][noteIx].select();
		}
	});

	//[drums,major,minor,blues,fullGrid,chords]
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

	$('#octave').change(function(){
		octave = $('option:selected', this).index()-1;
		console.log('which octave ',octave);
	})

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

	$('#output').change(function(){
		$('option:selected', this).index();
		instruments[currentGridIndex].out = $('option:selected', this).index();
	})

	// create new instance from user menu specs
	$(".newInsButton").click(function(){
		var instName = $("#insName").val();

		var duplicates = true;
		var numToAppend = 1;
		var names = instruments.map(a => a.name);

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

		var rowCount = $("#rowCount").val();
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

		socket.emit('newInst',{
			name: instName,
			rows: rowCount,
			type: presets[type],
			roomID: roomID,
			user: user,
			root: thisRoot
		});
	});

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

	$("#clearall").click(function(){
		socket.emit('clearall',
		{
			roomID: roomID,
			user: user
		})
	})

	// update grid on clear
	socket.on('clearcurrentreturn', function(data){
		console.log(data);
		instruments[data.inst].clear(data.grid);
	});

	socket.on('clearallreturn', function(){
		for(var i = 0;i < instruments.length;i++){
			instruments[i].clear(i);
		}
	});

	$('#tempo').change(function(){
		tempo = $(this).val()
		socket.emit('tempo',
		{
			tempo: tempo,
			roomID: roomID,
			user: user
		});
	});

	socket.on('temporeturn',function(data){
		$('#tempo').val(data.tempo);
		beatDuration = 1000*(60/(data.tempo*15));
		frameRate(data.tempo/15);
	});

	$('#startstop').click(function(){
		$(this).toggleClass('started');
		if($(this).hasClass('started')){
			$(this).text('STOP');
			counter = 0;
			stopcounter = false;
			started = true;
			loop();
		}else{
			for(var i = 0; i < instruments.length; i++){
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

	$('#reversex').click(function(){
		socket.emit('reversex',
		{
			inst:currentGridIndex,
			gridix: currentThumb,
			roomID:roomID,
			user: user
		});
	});

	socket.on('reversexreturn',function(data){
		instruments[data.inst].gridReversed(data.grid,data.inst,data.gridix);
		console.log('inst:  ',data.inst);
		console.log('grid:  ', data.grid);
	})

	$('#reversey').click(function(){
		socket.emit('reversey',
		{
			inst:currentGridIndex,
			roomID:roomID,
			gridix: currentThumb,
			user: user
		});
	});

	socket.on('reverseyreturn',function(data){
		instruments[data.inst].gridReversed(data.grid,data.inst,data.gridix);
	})

	$(document).on('click','.grid.little',function(){
		var $gridThumbs = $('.grid.little');
		$gridThumbs.removeClass('selected')
		var $thumb = $(this);
		console.log(currentThumb);

		if(instruments[currentGridIndex].out && midiOut){
			midiOut.stopNote('all',instruments[currentGridIndex].out);
			console.log('Notes should have stopped');
		}

		currentThumb = $thumb.index();
		instruments[currentGridIndex].thumb = currentThumb;
		$('.tab-content.selected .grid').hide();
		$('.tab-content.selected .grid:eq('+currentThumb+')').show();
		$thumb.addClass('selected');
	})

	socket.on('getgridreturn',function(data){
		if(messageSender){
			instruments[data.inst].displayGrid(data.grid,data.inst,data.gridix);
		}
		messageSender = false;
	})


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
			refreshHistory = 0;
			$('.messages').append($('<li>').html('<i>' + data.user + ": " + '</i>' + data.message));
	});

	// update chat history for new connection
	socket.on('chat history', function(data){
		if (refreshHistory) {
			$('.messages').append($('<li>').html('<i>' + data.user + ": " + '</i>' + data.message));
		}
	});

	$(document).on('click','.deletetab',function(){
		var tab2delete = $('.deletetab').index(this);
		console.log('sending ix: ',currentGridIndex)
		socket.emit('deletetab',
		{
			tab2delete: tab2delete,
			roomID: roomID,
			user: user
		});
	});

	socket.on('deletereturn',function(data){
		ix = data.tab2delete+1;
		$('.tab-link:eq('+ix+')').parent().remove();
		$('.tab-content:eq('+ix+')').remove();
		$('.thumbs:eq('+(ix-1)+')').remove();
		var needsToToggle= lastIx >= ix-1 ? true:false;
		console.log('needs to toggle?   ', needsToToggle);
		ix-=1;
		instruments.splice(ix,1);
		if(needsToToggle){
			if(lastIx === 0){
				lastIx = 1;
			}

			console.log('lastIx:  ', lastIx);
			console.log('the index  ', lastIx, '  should be set to selected');

			$('.tab-link:eq('+(lastIx)+')').addClass('selected');
			$('.tab-content:eq('+(lastIx)+')').addClass('selected');
			$('.thumbs:eq('+(lastIx-1)+')').addClass('selected');
			currentGridIndex = lastIx - 1;
		} else {
			$('.tab-link:eq('+(lastIx+1)+')').addClass('selected');
			$('.tab-content:eq('+(lastIx+1)+')').addClass('selected');
			$('.thumbs:eq('+(lastIx)+')').addClass('selected');
			currentGridIndex = lastIx;
		}
	});
});

$(document).on('mousedown','.rowlabel',function(){
	var note = $(this).index();
	var rowNum = instruments[currentGridIndex].rows;
	note = instruments[currentGridIndex].type.midiNotes[rowNum-1-note]
	if(instruments[currentGridIndex].out && midiOut){
		midiOut.playNote(note,instruments[currentGridIndex].out);
		midiOut.stopNote(note,instruments[currentGridIndex].out,{time: '+500'});
	}
});

function draw() {
	if(started){
		counter = 0
		started = false;
	}else{
		counter += 1;
		counter = counter % columns;
	}

	for(i=0;i<instruments.length;i++){
		var currThumb = instruments[i].thumb;
		if(instruments[i].out && midiOut && instruments[i].notes.off[currThumb][counter]){
			midiOut.stopNote(instruments[i].notes.off[currThumb][counter],instruments[i].out);
		}
		if(instruments[i].out && midiOut && instruments[i].notes.on[currThumb][counter]){
			midiOut.playNote(instruments[i].notes.on[currThumb][counter],instruments[i].out);
		}
	}
	$('.step').removeClass('current');
	if(!stopcounter){
		allRows = $('.step:eq('+counter+')', '.row').toggleClass('current');
	} else {
		midiOut ? midiOut.stopNote('all'): console.error("You haven't set the MIDI out!");
	}
}

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
	var $step = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+")  .row:eq("+data.row+") .step:eq("+data.column+")");
	var $stepthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb:eq("+data.column+")");

	if(data.mousemode === 1){
		data.state = '';
	}
	switch(data.state){
		case '':
			$step.removeClass('clicked left right');
			if(data.onleft){
				$left = $(".gridContainer:eq("+data.inst+")  .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(data.column-1)+")");
				$left.addClass('right');
			}
			if(data.onright){
				$right = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(data.column+1)+")");
				$right.addClass('left');
			}
			$stepthumb.removeClass('clicked');
		break;
		case 'on':
			$step.addClass('clicked');
			$start = $step;
			if(data.mousemode == 2){
				$chord[0].push($step);
			}
			$stepthumb.addClass('clicked');
		break;
		case 'onoff':
			$step.addClass('clicked left right');
			$stepthumb.addClass('clicked');
			instruments[data.inst].steps[data.grid].push(new TBDnote($step.index(),$step.index(),data));
			instruments[data.inst].getNotes(getLastStep(data));
			if(data.mousemode === 2){
				$chord = [[],[]];
			}
		break;
		case 'sus':
			$step.removeClass('left right');
			$step.addClass('clicked');
			$stepthumb.addClass('clicked');
		break;

	case 'move':
	console.log(data.noteIx);

			data.column -= data.offset;
			instruments[data.inst].steps[data.grid][data.noteIx].move(data);
			instruments[data.inst].refreshSteps(data.grid);
			if(data.release){
				$('.step').removeClass('grabbing');
				var setNote = instruments[data.inst].steps[data.grid][data.noteIx];
				var neighbors = instruments[data.inst].steps[data.grid].filter(
					a => a.row === data.row);

					//remove reference to the note that we're checking against
				neighbors.splice(neighbors.indexOf(setNote),1);
				var overlappers = neighbors.filter(a=>a.inRange(setNote.on,setNote.off));
				var overlapTypes = [];
				overlappers.forEach(a => overlapTypes.push(overlapType(setNote,a)))
				console.log(overlapTypes);
				correctOverlaps(overlappers,overlapTypes, setNote,data);
				instruments[data.inst].refreshSteps(data.grid);
				instruments[data.inst].getNotes(setNote);
			}
		break;
		case 'off':
			grabbing = false;
			if(data.mousemode == 2){
				$chord[1].push($step);
			}
			if(data.flipped){
					$end = $start;
					$start = $step;
					if($chord[0].length === $chord[1].length && data.mousemode===2){
						$chord.reverse();
						console.log("reversed for the chord");
						chordUpdate($chord, data);
						$chord = [[],[]];
					}
			} else {
				$end = $step;
				if($chord[0].length === $chord[1].length && data.mousemode===2){
						console.log("reversed for the chord");
						chordUpdate($chord, data);
						$chord = [[],[]];
				}
			}
			if(data.mousemode != 2){
				if($start){
					$start.addClass('left clicked');
					instruments[data.inst].update($start,data.grid);
				}
				if($end){
					$end.addClass('right clicked');
				}
				instruments[data.inst].steps[data.grid].push(new TBDnote($start.index(),$end.index(),data));
				instruments[data.inst].getNotes(getLastStep(data));
			}
		break;
	}
}

function TBDnote(startpos,endpos,data){
	this.on = startpos;
	this.grid = data.grid;
	this.off = endpos;
	this.len = endpos - startpos;
	var stepSelected = false;
	this.row = data.row;
	this.$start = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+startpos+")");
	this.$end = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+endpos+")");
	//All of the html elements in the step
	this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);
	this.$startthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb:eq("+startpos+")");
	this.$endthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb:eq("+endpos+")");
	//All of the html elements in the thumb step
	this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);

	//Add classes for appropriate styling
	this.$els.addClass('clicked');
	this.$els.removeClass('left right');
	this.$elsthumb.addClass('clicked');
	this.$end.addClass('right');
	this.$start.addClass('left');

	this.move = function(data){
		this.$els.removeClass('left right clicked selected')
		this.$elsthumb.removeClass('clicked');
		this.row = data.row;
		this.on = data.column;
		//Shortens notes if brought to the edge
		if(this.on<0){
			this.on = 0;
		}
		this.off = data.column + this.len;
		if(this.off > 31){
			this.off = 31;
		}
		// Reset the jquery to refer to the moved location
		this.$start = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+this.on+")");
		this.$end = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(this.off)+")");
		this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);
		this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);
		this.$els.addClass('clicked');
		this.$start.addClass('left');
		this.$end.addClass('right');
		this.$els.addClass('selected grabbing');
		this.$elsthumb.addClass('clicked');
		// display = this.$els;
	}

	this.inRange = function(on,off){
		var isOverlapping = between(on,off,this.on) || between(on,off,this.off);
		var isWrapped = between(this.on,this.off,on) || between(this.on,this.off,off)
		console.log(isOverlapping,' that there is an overlap');
		return isOverlapping || isWrapped;
	}

	this.update = function(){
		this.$els.addClass('clicked').removeClass('highlighted');
		this.$start.addClass('left');
		this.$end.addClass('right');
		this.$elsthumb.addClass('clicked');
	}

	this.delete = function(){
		this.$els.removeClass('clicked left right highlighted selected')
		this.$elsthumb.removeClass('clicked')
	}

	this.select = function(){
		this.$els.addClass('clicked selected')
	}

	this.trimLeft = function(newOn,data){
		this.$start.removeClass('left')
		this.on = newOn;
		this.len = this.off - this.on;
		//Shortens notes if brought to the edge

		// Reset the jquery to refer to the moved location
		this.$start = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+this.on+")");
		this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);
		this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);
		this.$els.addClass('clicked');
		this.$start.addClass('left');
		this.$elsthumb.addClass('clicked');
	}

	this.trimRight = function(newOff,data){
		this.$end.removeClass('right')

		this.off = newOff;
		this.len = this.off - this.on;
		//Shortens notes if brought to the edge

		// Reset the jquery to refer to the moved location

		this.$end = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(this.off)+")");
		this.$els = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step").slice(this.on,this.off+1);
		this.$elsthumb = $(".thumbs:eq("+data.inst+") .grid.little:eq("+data.grid+") .row:eq("+data.row+") .stepthumb").slice(this.on,this.off+1);
		this.$els.addClass('clicked');
		this.$end.addClass('right');
		this.$elsthumb.addClass('clicked');

	}
}

function sendStep(state){
	socket.emit('step',{
		row: row,
		column: column,
		inst: currentGridIndex,
		roomID: roomID,
		mousemode: mousemode,
		user: user,
		shifted: shifted,
		state: state,
		grid: currentThumb
	});
}

function grabNote(){
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
		grab: true
	});
}

function releaseNote(){
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
		release: true
	});
}

function sendDelete(){
	socket.emit('delete step',{
		inst: currentGridIndex,
		grid: currentThumb,
		noteIx: noteIx,
		roomID: roomID,
		user: user
	});
}

function deleteNote(data){
	instruments[data.inst].removeNotes(instruments[data.inst].steps[data.grid][data.noteIx]);
	instruments[data.inst].steps[data.grid][data.noteIx].delete();
	instruments[data.inst].steps[data.grid].splice(data.noteIx,1)
}


function chordUpdate($chord, data){
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

function getLastStep(data){
	noteIx = instruments[data.inst].steps[data.grid].length;
	noteIx -= 1;
	var thisStep = instruments[data.inst].steps[data.grid][noteIx];
	return thisStep;
}

function between(lower,upper,check){
	if(check >= lower && check <= upper){
		return true;
	} else {
		return false;
	}
}

function overlapType(moved, overlap){
	if(between(moved.on,moved.off, overlap.off) && between(moved.on,moved.off, overlap.on)){
		return 'covered'
	} else if (!between(moved.on,moved.off, overlap.off) && !between(moved.on,moved.off, overlap.on)){
		return 'wrapping'
	} else if (between(moved.on,moved.off, overlap.off) && overlap.on < moved.on){
		return 'onleft';
	} else {
		return 'onright';
	}
}

function correctOverlaps(overlaps,overlapCase,moved,data){
	for(i=0;i<overlaps.length;i++){
		var currIx = instruments[data.inst].steps[data.grid].indexOf(overlaps[i]);
		console.log('currIx  ', currIx);
		switch(overlapCase[i]){
			case 'covered':
				data.noteIx = currIx;
				deleteNote(data);

			break;

			case 'wrapping':
			instruments[data.inst].steps[data.grid].push(new TBDnote(moved.off+1,overlaps[i].off,data));
			instruments[data.inst].steps[data.grid][currIx].trimRight(moved.on-1,data)
			console.log(overlaps[i]);

			break;

			case 'onleft':
			instruments[data.inst].steps[data.grid][currIx].trimRight(moved.on-1,data)
			break;
			case 'onright':
				instruments[data.inst].steps[data.grid][currIx].trimLeft(moved.off+1,data)
			break;
		}
	}
}
