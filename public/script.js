// node modules
var socket = io();

// initialize values


var rootNote = 40;
var row, column;
var columns = 32;
var lastCellLeft,twoCellsBack;

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

var roomID = -1;
var username = "";
var currInst;

function setup(){
	frameRate(2);
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

	} else if (url.includes("http://localhost:8081/")) {
		// if a room is appended to base url, join that room
		if (url.replace("http://localhost:8081/","") != "") {
			// get the roomID from url string
			roomID = url.replace("http://localhost:8081/","")
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
	        username = $('#username').val();
	    });
	// modal for username only if roomID came from url
	} else {
		// autofill room and pick username if room provided in url
		$('#roomPicker').modal('show');
		$('#greeting').text("Pick a username for the sesh!")
		$('#roomName').hide();
	    $('#roomButton').click(function(e) {
	        username = $('#username').val();
	    });
	}

	// get current grid state from server
	socket.on('joinSession',function(data){

	if(data.instruments){
		for (var h = 0; h < data.instruments.length;h++){
			currInst = data.instruments[h];
			instruments.push(new TBDgrid(currInst.name,currInst.rows,currInst.cols,currInst.type));
			instruments[h].connection(currInst.grid,h);
		}
	}
	});

	// initial grid and mouse states
	// var tweet = grid(rows, columns, $(".gridContainer"));
	var mouseIsClicked = false;
	var stepEntered = false;

	// cell click
	$(document).on("mouseleave",'.selected .grid',function(){
		mouseIsClicked = false;
	})
	$(document).on("mousedown",'.selected .row .step',function(){
		// track mouse state
		mouseIsClicked = true;

		// toggle corresponding polarity grid cell
		column = $(this).index();
		row = $(this).parent().index();

		// send step coordinates
		socket.emit('step',{
			row: row,
			column: column,
			inst: currentGridIndex,
			roomID: roomID
		});
	// exit on unclick
	}).on("mouseup",'.row .step',function(){
		mouseIsClicked = false;
	// subsequent dragged cells
	}).on("mouseleave",'.selected .row .step',function(){
			// toggle corresponding polarity grid cell
			if(mouseIsClicked){
				if(lastCellLeft){
					twoCellsBack = lastCellLeft;
					$(".twoCellsBack").removeClass("twoCellsBack");
				    $(".lastcell").toggleClass("twoCellsBack");
				}
			column = $(this).index();
			row = $(this).parent().index();
			$(".lastcell").removeClass("lastcell");
			lastCellLeft=$(this).toggleClass("lastcell");
			}
		}).on("mouseenter", '.selected .row .step',function(){
		if(mouseIsClicked){
			// toggle corresponding polarity grid cell
			if($(this).hasClass("twoCellsBack")){
				lastCellLeft.toggleClass("clicked")
			}
			column = $(this).index();
			row = $(this).parent().index();

			// send step coordinates
			socket.emit('step',{
				row: row,
				column: column,
				inst: currentGridIndex,
				roomID: roomID
			});
		}
	});

	// update steps from all users
	socket.on('stepreturn',function(data){
		$(".gridContainer:eq("+data.inst+") .row:eq("+data.row+") .step:eq("+data.column+")").toggleClass("clicked");
		instruments[data.inst].poleGrid[data.row][data.column] *= -1;
		instruments[data.inst].updateNotes(data.row,data.column);
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

	$("#presets").change(function(){
		type = $('option:selected', this).index()-1;
	});


	// create new instance from user menu specs
	$(".newInsButton").click(function(){
		var instName = $("#insName").val();
		var rowCount = $("#rowCount").val();


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
		tempo = $(this).val()/60;
		socket.emit('tempo',
		{
			tempo: tempo,
			roomID: roomID
		});
	});

	socket.on('temporeturn',function(data){
		// clock.frequency.value = data.tempo;
		$('#tempo').val(data.tempo*60);
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
		notesToPlay = instruments[i].notes[counter].filter(function(val){
		return instruments[i].notesToOff[counter].indexOf(val) == -1;
		});
		notesToStop = instruments[i].notesToOff[counter].filter(function(val){
		return instruments[i].notes[counter].indexOf(val) == -1;
		});
		}else{
			notesToPlay = instruments[i].notes[counter];
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

// grid creation function for init and new tabs
