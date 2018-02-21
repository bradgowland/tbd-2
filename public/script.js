// node modules
var socket = io();

// initialize values
var rootNote = [21,45,69];
// var rootNote = 45;
var row, column, objGrid,lastCellLeft,twoCellsBack,tempo,ix,columnChanged;

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
var octave;
$()
function setup(){
	frameRate(8);
	noLoop();
}
$('.container').hide();
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
				instruments.push(new TBDgrid(currInst.name,currInst.rows,currInst.cols,currInst.type,currInst.root));
				objGrid = currInst.grid;
				instruments[h].connection(currInst.grid,h);
				instruments[h].connection([currInst.grid[0]],h);
				$('#tempo').val(data.tempo);
				frameRate(data.tempo/15);
			}

		}

		// get current list of Users
		users = data.users;

		// TODO: get current tempo
		showTab(instruments.length);
		currentGridIndex = instruments.length-1;
		lastIx = currentGridIndex;
		$('.thumbs:eq('+currentGridIndex+')').addClass('selected');
		$('.container').show();
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

	$('#octave').change(function(){
		octave = $('option:selected', this).index()-1;
		console.log('which octave',octave);

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


	// create new instance from user menu specs
	$(".newInsButton").click(function(){
		var instName = $("#insName").val();
		var rowCount = $("#rowCount").val();
		if(octave > -1){
		var thisRoot = rootNote[octave];
	}else{
		thisRoot = rootNote[1];
	}
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

		console.log(data);
		instruments.push(new TBDgrid(data.name,data.rows,columns,data.type,data.root));
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
			gridix: currentThumb,
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
		instruments[data.inst].clear(data.inst);
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
		// clock.frequency.value = data.tempo;
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
			// clock.start();
			loop();
		}else{
			for(var i = 0; i < instruments.length; i++){
				if(instruments[i].out){
					instruments[i].out.stopNote('all',1)
				}
				$('.step').removeClass('current');

			}
			$(this).text('Start');
			// clock.stop();
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
		currentThumb = $thumb.index();
		instruments[currentGridIndex].thumb = currentThumb;
		$('.tab-content.selected .grid').hide();
		$('.tab-content.selected .grid:eq('+currentThumb+')').show();
		$thumb.addClass('selected');
		// messageSender = true;
		// socket.emit('getgrid',
		// {
		// 	inst:currentGridIndex,
		// 	gridix:currentThumb,
		// 	roomID: roomID
		// });
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
	}else{
		$('.tab-link:eq('+(lastIx+1)+')').addClass('selected');
		$('.tab-content:eq('+(lastIx+1)+')').addClass('selected');
		$('.thumbs:eq('+(lastIx)+')').addClass('selected');
		currentGridIndex = lastIx;
	}
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

	if(started){
		counter = 0
		started = false;
	}else{
		counter += 1;
		counter = counter % columns;
	}

	// counter = frameCount%columns;
	for(i=0;i<instruments.length;i++){
		var currThumb = instruments[i].thumb;
		if(instruments[i].out && instruments[i].notes.off[currThumb][counter]){
			instruments[i].out.stopNote(instruments[i].notes.off[currThumb][counter],1);
		}

		if(instruments[i].out && instruments[i].notes.on[currThumb][counter]){
			instruments[i].out.playNote(instruments[i].notes.on[currThumb][counter],1);
		}

	}
	$('.step').removeClass('current');
	if(!stopcounter){
	allRows = $('.step:eq('+counter+')', '.row').toggleClass('current');
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
					instruments[data.inst].update($left, data.grid);
				}
				if(data.onright){
					$right = $(".gridContainer:eq("+data.inst+") .grid:eq("+data.grid+") .row:eq("+data.row+") .step:eq("+(data.column+1)+")");
					$right.addClass('left');
					instruments[data.inst].update($right, data.grid);
				}
				instruments[data.inst].update($step, data.grid);
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
		instruments[data.inst].update($step,data.grid);
		$stepthumb.addClass('clicked');
		if(data.mousemode === 2){
			$chord = [[],[]];
		}
		break;
	case 'sus':
		$step.removeClass('left right');
		$step.addClass('clicked');
		instruments[data.inst].update($step,data.grid);

		$stepthumb.addClass('clicked');

		break;
	case 'off':
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
				}else{
					$end = $step;
				if($chord[0].length === $chord[1].length && data.mousemode===2){
						console.log("reversed for the chord");
						chordUpdate($chord, data);
						$chord = [[],[]];
				}
			}

			if(data.mousemode != 2){
				if($start){$start.addClass('left clicked');
				instruments[data.inst].update($start,data.grid);}
				if($end){$end.addClass('right clicked');
				instruments[data.inst].update($end,data.grid);
				}
			}
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
			user: user,
			shifted: shifted,
			state: state,
			grid: currentThumb
		});
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



// grid creation function for init and new tabs
