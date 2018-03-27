var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// TBD instrument object defintion
function TBDgrid(name, rows, cols,type, root, outChan){
	// initialize type and location
	this.rows = rows;
	this.cols = cols;
	this.thumb = 0;
	this.name = name;
	this.steps = [[],[],[],[]];
	this.rootNote = root;
  this.out = outChan;
  this.type = type;

	// update style while moving
	this.refreshSteps = function(currThumb) {
		this.steps[currThumb].forEach(function(el) {
			el.update();
		});
	};

	// note indexes
	this.notes = {
		on: [],
		off: [],
	}

	// create note arrays for each of the 4 thumbs
	for(var h = 0;h < 4; h++){
		this.notes.on.push([]);
		this.notes.off.push([]);

		// each note in each thumb
		for (var i = 0; i<columns; i++) {
			this.notes.on[h].push([]);
			this.notes.off[h].push([]);
		}
	}

	// allow to set default row number
	if (type.rows) {
		this.rows = type.rows;
	}

	// if type is minor, create relative minor of major reference key
	this.rootNote = type.minor ? this.rootNote - 3 : this.rootNote;

	// create melodic instrument
	if(type.melodic){
		var scaleLen = type.scale.length;
		// repeats the scale while moving up octaves
		for(i = 0; i <this.rows; i++){
			var oct = Math.floor(i/scaleLen);
			this.type.midiNotes.push(this.rootNote + type.scale[i%scaleLen]+ (12*oct))
		}
		// uses the notes to create the note labels
		for(i = 0;i < this.rows;i++){
			this.type.labels.push(findNoteFromNumber(this.type.midiNotes[i]));
		}
	}

	// TODO: delete after chord updates
	this.update = function($el, thumbIx){
		var col = $el.index();
		var row = $el.parent().index();
		var thisMidiNote = type.midiNotes[rows-row-1];

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

	// TODO: update steps for reverse or delete
	this.gridReversed = function(grid,index,gridix) {

	}

	// take index from step and add to note array
	this.getNotes = function(thing) {
			var midiVal = this.type.midiNotes[this.rows - 1 - thing.row];

			var onIndex = this.notes.on[thing.grid][thing.on].indexOf(midiVal);
			// check to prevent duplicates in the note on array
			onIndex === -1 ? this.notes.on[thing.grid][thing.on].push(midiVal) : console.log('');
			this.notes.off[thing.grid][(thing.off+1)%32].push(midiVal);
	}

	// take index from step and remove from note array
	this.removeNotes = function(thing) {
		var midiVal = this.type.midiNotes[this.rows - 1 - thing.row];
		var onIndex = this.notes.on[thing.grid][thing.on].indexOf(midiVal);
		var offIndex = this.notes.off[thing.grid][(thing.off+1)%32].indexOf(midiVal);
		this.notes.on[thing.grid][thing.on].splice(onIndex, 1);
		this.notes.off[thing.grid][(thing.off+1)%32].splice(offIndex, 1);
	}

	// clear jQuery and references to notes for grid clearing
	this.clear = function(ix){
		this.notes.on[ix] = [];
		this.notes.off[ix] = [];
		for (var i = 0; i<columns; i++) {
			this.notes.on[ix].push([]);
			this.notes.off[ix].push([]);
		}
		this.steps[ix].forEach(a => a.clearBorder());
		this.steps[ix].forEach(a => a.delete());
		this.steps[ix] = [];
	}

	// Creates the Instrument Tag Link
	var newTab = '<li><a class="tab-link" data-tab="' + name + '">' + name +
		'<input type="image" class="deletetab" src="images/littlex.png"></input></a></li>';
	$('.tabs').append(newTab);

	// Creating The Tab Pane
	var newPane = $('<div class="tab-content" id="'+name+'"></div>');
	var gc = $('<div class="gridContainer"></div>').appendTo(newPane);
	newPane.appendTo($('#tab-spot'));


	// Setting flexible grid dimensions
	var w = 100 / columns;
	var h;
	if (this.rows > 40) {
		h = 5;
	} else {
		h = 100 / this.rows;
	}


	// Creating the column of labels
	var labels = $("<div class='gridlabels'></div>");
	for (var i = 0; i < this.rows; i++) {
		thisNote = type.labels[(this.rows-i-1)%this.rows];
		var rowLabel = $("<div class='rowlabel'>" + thisNote + "</div>").appendTo(labels);
	}
	gc.append(labels);

	// create the grid
	var gr = $("<div class='grid'></div>")
	for (var i = 0; i < this.rows; i++) {
		var row = $("<div class='row'></div>").appendTo(gr);
		if (this.type.labels[this.rows-i-1][1] === '#') {
			row.addClass('sharp');
		}
		for (var k = 0; k < columns; k++) {
			row.append("<div class='step'></div>");
		}
	}
	gc.append(gr);

	// if user specifies > 30 rows, grid should scroll
	if(this.rows > 30){
		gc.addClass('fullgrid')
	}

	// create rows heights by pct if under scrolling boundary
	if (this.rows<29) {
		gr.parent().find(".rowlabel").css({
			"height": h+"%"
		});
	}

	// size elements based on pct for flexible resizing
	gr.find(".row").css({
		"height": h+"%"
	});
	gr.find(".step").css({
		"width": w+"%"
	});

	// create and style time division by quarter notes
	for(var i = 0; i < columns; i++){
		var overFour = Math.floor(i/4);
			if(overFour%2 === 1){
			$('.step:eq('+i+')', '.row').addClass('quarter');
		}
	}

	// create hidden thumbs to quickly toggle by show/hide
	for(var i = 0 ; i < 3; i++){
		var gridClone = gr.clone();
		gc.append(gridClone);
		gridClone.hide();
	}

	// create thumbs by cloning grids
	var lilGrid = gr.clone();
	lilGrid.addClass('little');
	var tr = $('.toprow');
	lilGrid.find(".step").css({
		"width": (Math.floor(w))+"%",
	});

	lilGrid.find(".row").css({
		"height": 100/this.rows+"%"
	});


	// append thumbs to associated instrument
	lilGrid.find(".step").addClass('stepthumb');

	// remove step class to avoid selecting steps within thumbs
	lilGrid.find(".stepthumb").removeClass('step');
	var $thumbs = $("<div class='thumbs'></div>");
	$thumbs.append(lilGrid);

	// append grid clones to thumbs
	for (var i = 0 ; i < 3; i++) {
		$thumbs.append(lilGrid.clone());
	}

	// select first by default
	lilGrid.addClass('selected');
	tr.append($thumbs);
}

// get note name from MIDI note number
function findNoteFromNumber(num){
	var theNote = noteNames[num%12];
	var octaveNum = Math.floor(num/12) - 1;
	return theNote+octaveNum;
}
