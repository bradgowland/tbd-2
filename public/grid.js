var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];






function TBDgrid(name, rows, cols,type, root, outChan){
	this.rows = rows;
	this.cols = cols;
	this.thumb = 0;
	this.name = name;
	this.steps = [[],[],[],[]]
	this.refreshSteps = function(currThumb){
		this.steps[currThumb].forEach(function(el){
			el.update();
		})
	}
	this.rootNote = root;
	this.notes = {
		on: [],
		off: []
	}

	for(var h = 0;h < 4; h++){
			this.notes.on.push([]);
			this.notes.off.push([]);
			for(var i = 0; i<columns; i++){
				this.notes.on[h].push([]);
				this.notes.off[h].push([]);
			}
	}

	this.out=outChan;
	this.type = type;
	if(type.rows){
		this.rows = type.rows;
		// console.log(this.rows);
	}

	this.rootNote = type.minor ? this.rootNote - 3 : this.rootNote;

	if(type.melodic){
		console.log('Generating scale!');
		var scaleLen = type.scale.length;
		//repeats the scale while moving up octaves
		for(i = 0; i <this.rows; i++){
			var oct = Math.floor(i/scaleLen);
			this.type.midiNotes.push(this.rootNote + type.scale[i%scaleLen]+ (12*oct))
		}
		//uses the notes to create the note labels
		for(i = 0;i < this.rows;i++){
			this.type.labels.push(findNoteFromNumber(this.type.midiNotes[i]));

		}
	}

	this.update = function($el, thumbIx){

		var col = $el.index();
		var row = $el.parent().index();
		var thisMidiNote = type.midiNotes[rows-row-1];

		// console.log('row:  ', row, '  thisMidiNote',thisMidiNote);
		var onIx = this.notes.on[thumbIx][col].indexOf(thisMidiNote);
		var offIx = this.notes.off[thumbIx][(col+1)%this.cols].indexOf((type.midiNotes[rows-row-1]));
		if($el.hasClass('left') && $el.hasClass('right')){
			if(onIx == -1){this.notes.on[thumbIx][col].push(thisMidiNote);}
			if(offIx == -1){this.notes.off[thumbIx][(col+1)%columns].push(thisMidiNote);}
		}else if($el.hasClass('left')){
			if(onIx == -1){this.notes.on[thumbIx][col].push(thisMidiNote);}
		}else if($el.hasClass('right')){
			if(offIx == -1){this.notes.off[thumbIx][(col+1)%columns].push(thisMidiNote);}
		}else{
			if(onIx>-1){
					this.notes.on[thumbIx][col].splice(onIx,1);
			}
			if(offIx>-1){
					this.notes.off[thumbIx][(col+1)%this.cols].splice(offIx,1);
			}
		}
	}

	this.displayGrid = function(grid,index,thumb){
		for (var j = 0; j<grid.length;j++){
			for (var k = 0; k < columns; k++) {
				var currCell = {
					inst: index,
					row: j,
					column: k,
					state: grid[j][k].state,
					grid: thumb
				}
				stepReturn(currCell);

	}
}
}
this.gridReversed = function(grid,index,gridix){
		for (var j = 0; j<grid.length;j++){
			for (var k = 0; k < columns; k++) {
				var currCell = {
					inst: index,
					row: j,
					column: k,
					state: grid[j][k].state,
					grid: gridix
				}
				stepReturn(currCell);
			}
		}
}

	this.connection = function(grid, index){
		for (var i = 0; i < grid.length ; i++) {
			var connection = i === 0 ? true:false;
			for (var j = 0; j<grid[0].length;j++){
				for (var k = 0; k < columns; k++) {
					if(grid[i][j][k].state){
					var currCell = {
						inst: index,
						row: j,
						column: k,
						state: grid[i][j][k].state,
						grid: i,
						connection: connection
					}
					stepReturn(currCell);
				}
					}
				}
			}
		}


	this.getNotes = function(thing){
			var midiVal = this.type.midiNotes[this.rows - 1 - thing.row];
			var onIndex = this.notes.on[thing.grid][thing.on].indexOf(midiVal);
			//This check prevent duplicates in the note on array...
			onIndex === -1 ? this.notes.on[thing.grid][thing.on].push(midiVal):console.log('Midi value ', midiVal, 'already here') ;
			this.notes.off[thing.grid][(thing.off+1)%32].push(midiVal);
	}

	this.removeNotes = function(thing){
		var midiVal = this.type.midiNotes[this.rows - 1 - thing.row];
		var onIndex = this.notes.on[thing.grid][thing.on].indexOf(midiVal);
		var offIndex = this.notes.off[thing.grid][(thing.off+1)%32].indexOf(midiVal);
		// console.log('on:  ', onIndex, 'off:  ',offIndex);
		this.notes.on[thing.grid][thing.on].splice(onIndex,1);
		this.notes.off[thing.grid][(thing.off+1)%32].splice(offIndex,1);

	}

	this.clear = function(ix){
		this.notes.on[ix] = [];
		this.notes.off[ix] = [];
		for(var i = 0; i<columns; i++){
				this.notes.on[ix].push([]);
				this.notes.off[ix].push([]);
		}
		this.steps[ix].forEach(a => a.delete());
		this.steps[ix] = [];
	}

	//Creates the Instrument Tag Link
	var newTab = '<li><a class="tab-link" data-tab="'+name+'">'+name+'  <input type="image" class="deletetab" src="littlex.png"></input></a></li>';
	$('.tabs').append(newTab);

	//Creating The Tab Pane
	var newPane = $('<div class="tab-content" id="'+name+'"></div>');
	var gc = $('<div class="gridContainer"></div>').appendTo(newPane);
	newPane.appendTo($('#tab-spot'));


	// Setting flexible grid dimensions
	var w = 100/columns;
	var h;
	if(this.rows > 40){
		h = 5;
	}else{
	h = 100/this.rows;
	}


	//Creating the column of labels
	var labels = $("<div class='gridlabels'></div>")
	// create the column of labels
	for(var i = 0; i < this.rows; i++){

		thisNote = type.labels[(this.rows-i-1)%this.rows];
		var rowLabel = $("<div class='rowlabel'>"+thisNote+"</div>").appendTo(labels);
	}
	gc.append(labels);

	// create the grid
	var gr = $("<div class='grid'></div>")

	for(var i = 0; i < this.rows; i++){
		var row = $("<div class='row'></div>").appendTo(gr);
		if(this.type.labels[this.rows-i-1][1] === '#'){
			row.addClass('sharp');
		}
		for(var k = 0; k < columns; k++){
			row.append("<div class='step'></div>");
		}
	}

	gc.append(gr);


	if(this.rows > 40){
		gc.addClass('fullgrid')
	}

	// size elements based pct for flexible resizing
	gr.find(".row").css({
		"height": h+"%"
	});

	gr.find(".step").css({
		"width": w+"%"
	});

	for(var i = 0; i < columns; i++){
		var overFour = Math.floor(i/4);
			if(overFour%2 === 1){
			$('.step:eq('+i+')', '.row').addClass('quarter');
		}
	}

	for(var i = 0 ; i < 3; i++){
		var gridClone = gr.clone();
		gc.append(gridClone);
		gridClone.hide();
	}



	if(this.rows<39){
	gr.parent().find(".rowlabel").css({
	"height": h+"%"
	});
	}
	var lilGrid = gr.clone();
	lilGrid.addClass('little');
	var tr = $('.toprow')

	lilGrid.find(".step").css({
		"width": (Math.floor(w))+"%"
	});

	lilGrid.find(".step").addClass('stepthumb');
	lilGrid.find(".stepthumb").removeClass('step');
	var $thumbs = $("<div class='thumbs'></div>");
	$thumbs.append(lilGrid);
	for(var i = 0 ; i < 3; i++){$thumbs.append(lilGrid.clone());}
	lilGrid.addClass('selected');
	tr.append($thumbs);



}

function findNoteFromNumber(num){
	var theNote = noteNames[num%12];
	var octaveNum = Math.floor(num/12) - 1;
	return theNote+octaveNum;
}

function remove(note, array){
	var index = array.indexOf(note);
	if(index > -1){
    array.splice(index, 1);
	}
	return array;
}




// $(".gridContainer:eq("+data.inst+") .row:eq("+data.row+") .step:eq("+data.column+")");
