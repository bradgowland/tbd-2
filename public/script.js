// node modules
var socket = io();

// initialize values
var rootNote = 40;
var row, column;
var columns = 32;
var lastCellLeft,twoCellsBack;
var userThatClicked = false;
var currentGridIndex = 0;
var counter = 0;
var tempo;
var ix;
var allRows;
var selectedOutput;
var instruments = [];
var searchIx;
var type;
var notesToPlay, notesToStop;
var mousemode = 0;
var reversing = false;
var beatDuration = 500;
var roomID = -1;
var username = "";
var users = [];
var currInst;
var shifted;
var start, $start;

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
					console.log(users.indexOf(username) + ": username " + username + " not available.");
					$('#roomPicker').modal('show');
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
				instruments[h].connection(currInst.grid,h);
			}
		}

		// get current list of Users
		users = data.users;

		// TODO: get current tempo
		showTab(instruments.length);
		currentGridIndex = instruments.length-1;

	});

	// initial grid and mouse states
	// var tweet = grid(rows, columns, $(".gridContainer"));
	var mouseIsClicked = false;
	// cell click
	$(document).on("mouseleave",'.selected .grid',function(){
		mouseIsClicked = false;
	})

	$(document).on("mousedown",'.selected .row .step',function(){
		// track mouse state
		mouseIsClicked = true;
		row = $(this).parent().index();
		column = $(this).index();
		// send step coordinates
		socket.emit('step',{
			row: row,
			column: column,
			inst: currentGridIndex,
			roomID: roomID,
			mousemode: mousemode,
			user: username,
			onoff: 'on',
		});
	// exit on unclick
}).on("mouseleave",'.selected .step',function(){
			// toggle corresponding polarity grid cell
			if(mouseIsClicked){
				if(lastCellLeft){
					twoCellsBack = lastCellLeft;
					$(".twoCellsBack").removeClass("twoCellsBack");
				  $(".lastcell").toggleClass("twoCellsBack");
				}
				// column = $(this).index();
				$(".lastcell").removeClass("lastcell");
				lastCellLeft=$(this).toggleClass("lastcell");
			}
		}).on("mouseenter", '.selected .row .step',function(){
		if(mouseIsClicked && $(this).index()!=column){
			// toggle corresponding polarity grid cell
			if($(this).hasClass("twoCellsBack")){
				reversing = true;
				column = lastCellLeft.index();
				socket.emit('step',{
					row: row,
					column: column,
					inst: currentGridIndex,
					roomID: roomID,
					mousemode: mousemode,
					user: username,
					shifted: shifted
				});
			}
			column = $(this).index();
			// row = $(this).parent().index();

			// send step coordinates

		if(mousemode === 1){
			row = $(this).parent().index();
			socket.emit('step',{
				row: row,
				column: column,
				inst: currentGridIndex,
				roomID: roomID,
				mousemode: mousemode,
				user: username,
				shifted: shifted
			});
		}

		if(mousemode === 0 || mousemode === 2){
			socket.emit('step',{
				row: row,
				column: column,
				inst: currentGridIndex,
				roomID: roomID,
				mousemode: mousemode,
				user: username,
				shifted: shifted
			});
		}
		}

	}).on("mouseup",'.row .step',function(){
		mouseIsClicked = false;
		reversing = false;
		$('.step').removeClass('twoCellsBack lastcell')
		column = $(this).index();
		socket.emit('step',{
			row: row,
			column: column,
			inst: currentGridIndex,
			roomID: roomID,
			mousemode: mousemode,
			user: username,
			onoff: 'off',
		});
	// subsequent dragged cells
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
		currentGridIndex = $("ul.tabs li a").index(this)-1;
		console.log(currentGridIndex);
		$(this).addClass('selected');
		$("#"+tab_id+"").addClass('selected');
		if(!$('.tab-content').hasClass('selected')){
		ix = $('.tab-link').index(this);
		$('.tab-content:eq('+ix+')').addClass('selected')
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
		currentGridIndex = instruments.length;
		instruments.push(new TBDgrid(data.name,data.rows,columns,data.type));
		if(userThatClicked){
			$('ul.tabs li a').removeClass('selected');
			$('.tab-content').removeClass('selected');
			$('ul.tabs li a:eq('+instruments.length+')').addClass('selected');
			$('.tab-content:eq('+instruments.length+')').addClass('selected');
			userThatClicked = false;
		}
	});

	// clear grid

	$("#clearcurrent").click(function(){
		socket.emit('clearcurrent',
		{
			inst: currentGridIndex,
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
			roomID:roomID
		});
	});

	socket.on('reversexreturn',function(data){
		instruments[data.inst].clear(data.inst);
		instruments[data.inst].connection(data.grid,data.inst);
		console.log('inst:  ',data.inst);
		console.log('grid:  ', data.grid);
	})

	$('#reversey').click(function(){
		socket.emit('reversey',
		{
			inst:currentGridIndex,
			roomID:roomID
		});
	});

	socket.on('reverseyreturn',function(data){
		instruments[data.inst].clear(data.inst);
		instruments[data.inst].connection(data.grid,data.inst);
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
	    $('.messages').append($('<li>').html('<i>' + data.username + ": " + '</i>' + data.message));
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

	$('#output').change(function(){
		// $(this).
	})

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
		ix-=1;
		instruments.splice(ix,1);
		$('.tab-link:eq('+ix+')').addClass('selected');
		$('.tab-content:eq('+ix+')').addClass('selected');
	})

});


function draw(){
	counter = frameCount%columns;
	for(i=0;i<instruments.length;i++){
		if (frameCount > 0){

		}
		if(instruments[i].out && notesToPlay){
			instruments[i].out.playNote(notesToPlay,1);
		}
		if(instruments[i].out && notesToStop){
			instruments[i].out.stopNote(notesToStop,1);
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
var $step = $(".gridContainer:eq("+data.inst+") .row:eq("+data.row+") .step:eq("+data.column+")");
if(data.onoff === 'off'){
	$step.toggleClass('clicked');
}
if(data.column > 0){
	var $left = $(".gridContainer:eq("+data.inst+") .row:eq("+data.row+") .step:eq("+(data.column-1)+")");
}
if(data.column < columns-1){
	var $right = $(".gridContainer:eq("+data.inst+") .row:eq("+data.row+") .step:eq("+(data.column+1)+")");
}
if(data.onoff === 'on'){
	 start = data.column;
	 $start = $step;
}

if($step.hasClass('clicked')){
	$step.removeClass('left right');
	$right && $right.hasClass('clicked') ? $right.addClass('left'): $right = 0;
	$left && $left.hasClass('clicked') ? $left.addClass('right'): $left = 0;

}
//For creating Blocks of varying lengths designates ends
if(data.onoff === 'off'){
	$step.toggleClass('clicked');
	var end = data.column;
	if (end > start){
		$step.addClass('right');
		$start.addClass('left');
	}else if(end === start){
		$step.addClass("right left");
		$start = 0;
	}else if(end < start) {
		$step.addClass('left');
		$step.removeClass('right');
		$start.addClass('right');
	}
	//update notes in on off for the creation of blocks here!

}else{
	//for the dragged notes between on and offsets
		$step.toggleClass("clicked");
		// $step.removeClass('left right')
}

	if(!$step.hasClass('clicked')){
		$step.removeClass('left right');
	}



	$left ? instruments[data.inst].updateNotes(data.inst,$left): console.log('$left');
	$right ? instruments[data.inst].updateNotes(data.inst,$right): console.log('$right');
	$start ? instruments[data.inst].updateNotes(data.inst,$start):console.log('$start');
	instruments[data.inst].updateNotes(data.inst,$step);

	}



// grid creation function for init and new tabs
