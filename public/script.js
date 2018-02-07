// node modules
var socket = io();

// initialize values
var rootNote = 40;
var row, column, objGrid,lastCellLeft,twoCellsBack,tempo,ix,columnChanged;

var columns = 32;
var userThatClicked = false;
var currentGridIndex = 0;
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
var username = "";
var users = [];
var currInst;
var refreshHistory = 1;
var shifted;
var start, $start;
var clear;
var lastcolumn;
var passedStart;


function setup(){
	frameRate(8);
	noLoop();
}

//enable WebMIDI
WebMidi.enable(function(err){
	if(err){
		alert("Uh oh! Looks like WebMidi failed. Some browsers don't support WebMIDI, try Firefox or Chrome!!");
	}
	//List the outputs
	for(var i = 0; i < WebMidi.outputs.length;i++){
		$('#output').append("<option>"+WebMidi.outputs[i].name+"</option>")
	}

	// Sets instrument MIDI outs
	$('#output').change(function(){
		selectedOutput = $('option:selected', this).index()-1;
		if(selectedOutput < 0){
		instruments[currentGridIndex].out = 0;
		}else{
		instruments[currentGridIndex].out = WebMidi.outputs[selectedOutput];
		}
		console.log(instruments.out);
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
		// TODO: catch all for local network IPs -- take out after testing
		var temp = url.split("").reverse();
		roomID = temp.slice(0,temp.indexOf("/")).reverse().join("");

		// send roomID to server for connection
		socket.emit('room', {roomID: roomID});

		// update chat label with roomID
		var chatLabel = "In room: " + roomID;
		$('#chatRoom').text(chatLabel);
	}

	// modal for room if none provided
	if (roomID == "") {
		// pick room and username
	    $('#roomPicker').modal('show');
	    $('#roomButton').click(function(e) {
	        roomID = $("#roomName").val();

					// send roomID to server for connection
					socket.emit('room', {roomID: roomID});

					// capture username, send to server for association to room
					username = $('#username').val();
					socket.emit('user',
					{
							roomID: roomID,
							username: username
					});

					// update chat label with roomID
					var chatLabel = "In room: " + roomID;
					$('#chatRoom').text(chatLabel);
	    });
	// modal for username only if roomID came from url
	} else {
		// autofill room and pick username if room provided in url
		$('#roomPicker').modal('show');
		$('#greeting').text("Pick a username for the sesh!")
		$('#roomName').hide();
    $('#roomButton').click(function() {
				// capture username, send to server for association to room
				// TODO: check for username, only send if available
				username = $('#username').val();
				if (users.indexOf(username) == -1) {
					console.log(users.indexOf(username) + ": username " + username + " available.");
					socket.emit('user',
					{
							roomID: roomID,
							username: username
					});
				} else {
					// TODO: fix this, check for existing username doesn't show modal
					console.log(users.indexOf(username) + ": username " + username + " not available.");
					$('#roomPicker').modal('show');
					//TODO: this is not doing ANYTHING
					$('#greeting').text("Sorry - somebody already took that name! Try another.");
					$('#roomName').hide();
				}
    });
	}

	// get updated list of users after new member joins room
	socket.on('update users', function(data){
		users = data.users;
		console.log(users);
	});

	// get current grid state from server
	socket.on('joinSession',function(data){
		// update instruments
		if(data.instruments){
			for (var h = 0; h < data.instruments.length;h++){
				currInst = data.instruments[h];
				instruments.push(new TBDgrid(currInst.name,currInst.rows,currInst.cols,currInst.type));
				objGrid = currInst.grid;
				instruments[h].connection(currInst.grid,h);
				instruments[h].connection([currInst.grid[0]],h);
			}
		}

		// get current list of Users
		users = data.users;

		// TODO: get current tempo
		showTab(instruments.length);
		currentGridIndex = instruments.length-1;

		$('.thumbs:eq('+currentGridIndex+')').addClass('selected');

	});

	// initial grid and mouse states
	// var tweet = grid(rows, columns, $(".gridContainer"));
	var mouseIsClicked = false;

	// cell click
	$(document).on("mouseleave",'.selected .grid',function(){
		mouseIsClicked = false;
	})

	$(document).on("mousedown",'.selected .row .step',function(){
		//Sets whether pencil will be erasing or drawing
		passedStart = false;
		reversing = false;
		columnChanged = false;
		lastCellLeft = 0;
		twoCellsBack = -1;

		clear = $(this).hasClass('clicked') ? true : false;
		// console.log('Youre reversing ',reversing);
		// console.log('Youre clearing ',reversing);
		mouseIsClicked = true;
		//Grab current coordinates
		row = $(this).parent().index();
		column = $(this).index();

		var note = row;

		var rowNum = instruments[currentGridIndex].rows;

		note = instruments[currentGridIndex].type.midiNotes[rowNum-1-note]

		if(instruments[currentGridIndex].out && note){
			instruments[currentGridIndex].out.playNote(note,1);
			instruments[currentGridIndex].out.stopNote(note,1,{time: '+500'});
		}

		// store mouse starting point
		start = column;
		// set state to the proper mode
		state = clear || mousemode == 1 ? '' :  'on';

		sendStep(state);
	//Remember previous cell for turning around
}).on("mouseleave",'.selected .row .step',function(){
			if(mouseIsClicked && !clear){
				// only do this if we have in fact left any cells
				if(lastCellLeft && columnChanged){
					twoCellsBack = lastCellLeft;
				}
				column = $(this).index();
				passedStart = reversing && column === start ? true:false;
				if(columnChanged){
				lastCellLeft=column;
			}
			}
		}).on("mouseenter", '.selected .row .step',function(){
		if(mouseIsClicked){
			columnChanged = column === $(this).index() ? false : true;
			if(passedStart){
				clear = true;
				reversing = false;
			}
			if($(this).index() === twoCellsBack){
				reversing = reversing ? false : true;
				//maybe just set clear to true???
				//sets cell to off if user goes back from whence he came
				column = lastCellLeft;
				state = reversing ? '' : 'sus';
				sendStep(state);
			}
			column = $(this).index();
		if(mousemode === 1){
			row = $(this).parent().index();
			state = '';
			sendStep(state);
		}

		if(mousemode === 0 || mousemode === 2){
			state = clear || reversing ? '' : 'sus';
			sendStep(state);
		}
		}
	}).on("mouseup",'.row .step',function(){
		mouseIsClicked = false;
		column = $(this).index();
		state = clear || reversing ? '' : 'off';
		sendStep(state);

		if(reversing && !clear && mousemode != 1){

			sendStep('off');
			sendStep('');
		}
		reversing = false;
		clear = false;
	});

	// update steps from all users
	socket.on('stepreturn',function(data){
		stepReturn(data);
	});

	//The tab toggler

	$(document).on("click","ul.tabs li a",function(){
		var tab_id = $(this).attr('data-tab');
		// console.log(tab_id);
		$('ul.tabs li a').removeClass('selected');
		$('.tab-content').removeClass('selected');
		$('.thumbs').removeClass('selected')
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
		var curThumb = instruments[currentGridIndex].thumb;
		$('.thumbs.selected .grid:eq('+curThumb+')').addClass('selected');
		}
		// This sets the output so the users knows that output on their current tab...
		if(instruments[currentGridIndex] && currentGridIndex>0){
			$('#output').val(instruments[currentGridIndex].out.name);
		}else{
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

//[drums,major,minor,blues,fullGrid,chords]
	$("#presets").change(function(){
		type = $('option:selected', this).index()-1;
		if(type>0){
		$('.preset-extras').show();
		$('.inst').show();
	}else{
		$('.preset-extras').hide();
		$('.inst').show();
	}
	});

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


	// create new instance from user menu specs
	$(".newInsButton").click(function(){
		var instName = $("#insName").val();
		var rowCount = $("#rowCount").val();
		if(!rowCount){
			rowCount = 12;
		}
		userThatClicked = true;

		socket.emit('newInst',{
			name: instName,
			rows: rowCount,
			type: presets[type],
			roomID: roomID
		});
	});

	socket.on('newInstReturn',function(data){
		instruments.push(new TBDgrid(data.name,data.rows,columns,data.type));
		if(userThatClicked){
			currentGridIndex = instruments.length-1;
			$('ul.tabs li a').removeClass('selected');
			$('.tab-content').removeClass('selected');
			$('.thumbs').removeClass('selected');
			$('ul.tabs li a:eq('+instruments.length+')').addClass('selected');
			$('.tab-content:eq('+instruments.length+')').addClass('selected');
			$('.thumbs:eq('+(instruments.length-1)+')').addClass('selected');
			userThatClicked = false;
		}
	});

	// clear grid

	$("#clearcurrent").click(function(){
		socket.emit('clearcurrent',
		{
			inst: currentGridIndex,
			gridix: currentThumb,
			roomID: roomID
		});
	});

	$("#clearall").click(function(){
		socket.emit('clearall', {roomID: roomID})
	})

	// update grid on clear
	socket.on('clearcurrentreturn', function(data){
		instruments[data.inst].clear(data.inst);
	});

	socket.on('clearallreturn', function(){
		for(var i = 0;i < instruments.length;i++){
			instruments[i].clear(i);
		}
	});

	$('#tempo').change(function(){
		tempo = $(this).val()/15;
		socket.emit('tempo',
		{
			tempo: tempo,
			roomID: roomID
		});
	});

	socket.on('temporeturn',function(data){
		// clock.frequency.value = data.tempo;
		$('#tempo').val(data.tempo*15);
		beatDuration = 1000*(60/(data.tempo*15));
		frameRate(data.tempo);
	});

	$('#startstop').click(function(){
		$(this).toggleClass('started');
		if($(this).hasClass('started')){
			$(this).text('STOP');
			counter = 0;
			// clock.start();
			loop();
		}else{
			$(this).text('Start');
			// clock.stop();
			noLoop();
			$('.step').removeClass('current');

		}
	});

	$('#reversex').click(function(){
		socket.emit('reversex',
		{
			inst:currentGridIndex,
			gridix: currentThumb,
			roomID:roomID
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
			gridix: currentThumb
		});
	});

	socket.on('reverseyreturn',function(data){
		instruments[data.inst].gridReversed(data.grid,data.inst,data.gridix);
	})

	$(document).on('click','.grid.little',function(){
		var $gridThumbs = $('.grid.little');
		$gridThumbs.removeClass('selected')
		var $thumb = $(this);
		currentThumb = $thumb.index();
		instruments[currentGridIndex].thumb = currentThumb;
		$('.tab-content.selected .grid').hide();
		$('.tab-content.selected .grid:eq('+currentThumb+')').show();
		$thumb.addClass('selected');
		messageSender = true;
		socket.emit('getgrid',
		{
			inst:currentGridIndex,
			gridix:currentThumb,
			roomID: roomID
		});
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
			$('.messages').append($('<li>').html('<i>' + data.username + ": " + '</i>' + data.message));
	});

	// update chat history for new connection
	socket.on('chat history', function(data){
			if (refreshHistory) {
				$('.messages').append($('<li>').html('<i>' + data.username + ": " + '</i>' + data.message));
			}
	});

	// min/max chat box
	$("#minMax").click(function(){
	    if($(this).html() == "-"){
	        $(this).html("+");
	    }
	    else{
	        $(this).html("-");
	    }
	    $("#chatWindow").slideToggle();
	});


	$(document).on('click','.deletetab',function(){
		var tab2delete = $('.deletetab').index(this);
		socket.emit('deletetab',
		{
			tab2delete: tab2delete,
			roomID: roomID
		});
	});

	socket.on('deletereturn',function(data){
		ix = data.tab2delete+1;
		$('.tab-link:eq('+ix+')').parent().remove();
		$('.tab-content:eq('+ix+')').remove();
		$('.thumbs:eq('+ix+')').remove();
		ix-=1;
		instruments.splice(ix,1);
		$('.tab-link:eq('+ix+')').addClass('selected');
		$('.tab-content:eq('+ix+')').addClass('selected');
		$('.thumbs:eq('+ix+')').addClass('selected');
	})
});

$(document).on('mousedown','.rowlabel',function(){
	var note = $(this).index();
	var rowNum = instruments[currentGridIndex].rows;
	note = instruments[currentGridIndex].type.midiNotes[rowNum-1-note]
	if(instruments[currentGridIndex].out){
		instruments[currentGridIndex].out.playNote(note,1);
		instruments[currentGridIndex].out.stopNote(note,1,{time: '+500'});
	}
});


function draw(){
	counter = frameCount%columns;
	for(i=0;i<instruments.length;i++){
		if(instruments[i].out && instruments[i].notes.off[counter]){
			instruments[i].out.stopNote(instruments[i].notes.off[counter],1);
		}

		if(instruments[i].out && instruments[i].notes.on[counter]){
			instruments[i].out.playNote(instruments[i].notes.on[counter],1);
		}

	}
	$('.step').removeClass('current');
	allRows = $('.step:eq('+counter+')', '.row').toggleClass('current');
}




// message submit and tag search fn def
function messageSubmit() {
	// username
	var username = $('#username').val();
	// message
	var message = $('#chatInput').val()

	// sent plain chat to server
	socket.emit('chat to server',
	{
		username: username,
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
	// console.log(data.state);


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
					instruments[data.inst].update($left);
				}
				if(data.onright){
					$right = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(data.column+1)+")");
					$right.addClass('left');
					instruments[data.inst].update($right);
				}
				instruments[data.inst].update($step);
		$stepthumb.removeClass('clicked');
		break;
	case 'on':
		$step.addClass('clicked');
		$start = $step;
		$stepthumb.addClass('clicked');
		break;
	case 'onoff':
		$step.addClass('clicked left right');
		instruments[data.inst].update($step);
		$stepthumb.addClass('clicked');
		break;
	case 'sus':
		$step.removeClass('left right');
		$step.addClass('clicked');
		instruments[data.inst].update($step);

		$stepthumb.addClass('clicked');

		break;
	case 'off':
		console.log(data.mousemode);
				if(data.flipped){
					$end = $start;
					$start = $step;
				}else{
					$end = $step;
				}
				$start.addClass('left clicked');
				$end.addClass('right clicked');
				instruments[data.inst].update($start);
				instruments[data.inst].update($end);
			break;
		}
	}

	function sendStep(state){
		socket.emit('step',{
			row: row,
			column: column,
			inst: currentGridIndex,
			roomID: roomID,
			mousemode: mousemode,
			user: username,
			shifted: shifted,
			state: state,
			grid: currentThumb
		});
	}



// grid creation function for init and new tabs
