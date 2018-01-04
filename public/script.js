// node modules
var socket = io();

// initialize values
var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var row, column;
var thisRow;

var columns = 32; 
var lastCellLeft; 
var twoCellsBack;
var currentGridIndex = 0;
var numInsts = 0;	
var grids = [];
var counter = 0;
var tempo;
var allRows;
 //this is frequency whereas p5 was the duration of the tick	

//enable WebMIDI
WebMidi.enable(function(err){
	if(err){
		alert("Uh oh! Looks like WebMidi failed. Some browsers don't support WebMIDI, try Firefox or Chrome!!");
	}

	//List the outputs
	for(var i = 0; i < WebMidi.outputs.length;i++){
		$('#output').append("<option>"+WebMidi.outputs[i].name+"</option>")
	}




})

// page interaction
$(document).ready(function(){
	// initial grid and mouse states
	// var tweet = grid(rows, columns, $(".gridContainer"));
	var mouseIsClicked = false;
	var stepEntered = false;

	// cell click
	$(document).on("mousedown",'.selected .row .step',function(){
		// track mouse state
		mouseIsClicked = true;
		console.log("You're clicking");
		
		// toggle corresponding polarity grid cell
		column = $(this).index();
		row = $(this).parent().index();
		grids[currentGridIndex][row][column] *= -1;
		
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
				// console.log(twoCellsBack)
			}

			column = $(this).index();
			row = $(this).parent().index();
			console.log('You left:  ', column, row);
			$(".lastcell").removeClass("lastcell");
			lastCellLeft=$(this).toggleClass("lastcell");
			}
			// theGrid[row][column] =  theGrid[row][column] * -1;
			
			// // send step coordinates
			//  socket.emit('step',{
			// 	row: row,
			//  	column: column
		 // // });
		}).on("mouseenter", '.selected .row .step',function(){
		if(mouseIsClicked){

			// toggle corresponding polarity grid cell
			if($(this).hasClass("twoCellsBack")){
				lastCellLeft.toggleClass("clicked")
				
			}

			column = $(this).index();
			row = $(this).parent().index();
			// console.log('You entered:  ',column,row)
			grids[currentGridIndex][row][column] *= -1;
			
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
		console.log(tab_id);
		$('ul.tabs li a').removeClass('selected');
		$('.tab-content').removeClass('selected');
		currentGridIndex = $("ul.tabs li a").index(this)-1;
		$(this).addClass('selected');
		$("#"+tab_id).addClass('selected');
		
		console.log(currentGridIndex);
	});

	// get current grid state from server
	socket.on('connection',function(data){
		
	grids = data.grid;
	if(grids){
		for (var h = 0; h < grids.length;h++){
			var thisGrid = grids[h];
			for (var i = 0; i < thisGrid.length ; i++) {
				for (var j = 0; j < columns; j++) {
					if (grids[h][i][j] > 0) {
						$(".gridContainer:eq("+h+") .row:eq("+i+") .step:eq("+j+")").toggleClass("clicked");
					}
				}
			}
		}
	}
	});

	

	// update style on '+' button
	$('#plus').mousedown(function(){
		$('.newInstrument').toggleClass("clicked");
	});

	// create new instance from user menu specs
	$(".newInsButton").click(function(){
		var instName = $("#insName").val();
		var rowCount = $("#rowCount").val();
		socket.emit('newInst',{
			name: instName,
			rowCount: rowCount
		});
		// console.log("instName:  ", instName);
		// console.log("rowCount:   ",rowCount);
	});

	socket.on('newInstReturn',function(data){
		console.log('rowCount:  ',data.rowCount,'name:  ', data.name);
		$('ul.tabs li a').removeClass('selected');
		$('.tab-content').removeClass('selected');
		
		//Create Tab
		var newTab = '<li><a class="tab-link selected" data-tab="'+data.name+'">'+data.name+'</a></li>';
		$('.tabs').append(newTab);

		//Creating The New Grid
		var newPane = $('<div class="tab-content selected" id="'+data.name+'"></div>');
		
		var gc = $('<div class="gridContainer"></div>').appendTo(newPane);
		// 	console.log(gc);
		var thisElement = $('.tab-content.current .gridContainer');
		

		var newGrid = grid(data.rowCount,32,gc);
		
		// console.log('the new grid:   ',newGrid);

		// gc.append(newGrid);
		newPane.appendTo($('#tab-spot'));
		currentGridIndex = numInsts;
		numInsts++;
		console.log('from new inst:  ', currentGridIndex);
		

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
			$(".gridContainer:eq("+data.inst+")").find(".clicked").removeClass("clicked");
			grids = data.grids;
	});

	socket.on('clearallreturn', function(data){
			$(".gridContainer").find(".clicked").removeClass("clicked");
			console.log("Clear all");
			grids = data.grids;
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
		console.log('row:  ', data.row, 'column:  ', data.column);
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

});

clock = new Tone.Clock(function(){
	
	$('.step').removeClass('current');
	counter = this.ticks%columns;
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








function grid(rows, columns, element){
	// initial values
	var w = 100/columns;
	var h = 100/rows;
	var labels = $("<div class='gridlabels'></div>")
	
	// console checks for grid dimensions
	console.log("height: " , element.height());
	console.log("width: ", element.width());

	// create the column of labels
	for(var i = 0; i < rows; i++){
		thisNote = noteNames[i%noteNames.length];
		thisOctave = Math.floor(i/noteNames.length);
		var rowLabel = $("<div class='rowlabel'>"+thisNote+thisOctave+"</div>").appendTo(labels);		
	}
	element.append(labels);

	// create the grid
	var gr = $("<div class='grid'></div>")

	for(var i = 0; i < rows; i++){
		var row = $("<div class='row'></div>").appendTo(gr);
		for(var k = 0; k < columns; k++){
			row.append("<div class='step'></div>");
		}
	}
	element.append(gr);

	// size elements based pct for flexible resizing
	gr.find(".row").css({
		"height": h+"%"
	});
	
	gr.find(".step").css({
		"width": w+"%"
	});
	gr.parent().find(".rowlabel").css({
	"height": h+"%"
	});

	// Create the polarity grid for click/unclick
	grids.push(createGrid(rows,columns))

	// return completed grid
	return gr;
}

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

