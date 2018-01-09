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

	// get current grid state from server
	socket.on('connection',function(data){
	if(data.grid){
		for (var h = 0; h < data.grid.length;h++){
			var thisGrid = data.grid[h];
			instruments[h].connection(thisGrid,h);
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
			inst: currentGridIndex
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
			// console.log('You entered:  ',column,row)
			// send step coordinates
			socket.emit('step',{
				row: row,
				column: column,
				inst: currentGridIndex
			});
		}
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


	})

	$("#presets").change(function(){
		type = $('option:selected', this).index()-1	
		console.log(type);
	});
		

	// create new instance from user menu specs
	$(".newInsButton").click(function(){
		var instName = $("#insName").val();
		var rowCount = $("#rowCount").val();

		
		socket.emit('newInst',{
			name: instName,
			rowCount: rowCount,
			type: presets[type]
		});
	});

	socket.on('newInstReturn',function(data){
		currentGridIndex = instruments.length;
		instruments.push(new TBDgrid(data.name,data.rowCount,columns,data.type));
	});

	// clear grid
	
	$("#clearcurrent").click(function(){
		socket.emit('clearcurrent',{inst: currentGridIndex});
	});

	$("#clearall").click(function(){
		socket.emit('clearall')
	})

	// update grid on clear
	socket.on('clearcurrentreturn', function(data){
		instruments[data.inst].clear(data.inst);
		// $(".gridContainer:eq("+ix+")").find(".clicked").removeClass("clicked");
	});

	socket.on('clearallreturn', function(){
		for(var i = 0;i < instruments.length;i++){
			instruments[i].clear(i);
		}
	});

	$('#tempo').change(function(){
		tempo = $(this).val()/60;
		socket.emit('tempo',{tempo: tempo});
	});

	socket.on('temporeturn',function(data){
		clock.frequency.value = data.tempo;
		$('#tempo').val(data.tempo*60);
	});

	$('#startstop').click(function(){
		$(this).toggleClass('started');
		if($(this).hasClass('started')){
			$(this).text('STOP');
			counter = 0;
			clock.start();
		}else{
			$(this).text('Start');
			clock.stop();
			$('.step').removeClass('current');

		}
	})


	// update steps from all users
	socket.on('stepreturn',function(data){	
		$(".gridContainer:eq("+data.inst+") .row:eq("+data.row+") .step:eq("+data.column+")").toggleClass("clicked");
		instruments[data.inst].poleGrid[data.row][data.column] *= -1;
		instruments[data.inst].updateNotes(data.row,data.column);
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

	// clear chat
	// TODO: ONLY NEEDED UNTIL ROOMS //
	$("#chatClear").click(function(){
		socket.emit('chatClearSend');
	});
	socket.on('chatClearReturn', function(data){
	    $('.messages').html('');	
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
		var tab_to_delete = $('.deletetab').index(this);
		socket.emit('deletetab',{tab2delete: tab_to_delete});
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

clock = new Tone.Clock(function(){
	counter = this.ticks%columns;
	for(i=0;i<instruments.length;i++){
		if(instruments[i].out && instruments[i].notes[counter]){
			instruments[i].out.playNote(instruments[i].notes[counter],1);
			instruments[i].out.stopNote(instruments[i].notes[counter],1,{time: '+750'});
		}
	}
	$('.step').removeClass('current');
	allRows = $('.step:eq('+counter+')', '.row').toggleClass('current');
}, 2);



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
	});

    $('#chatInput').val('');
}

// grid creation function for init and new tabs








	