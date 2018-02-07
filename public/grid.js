var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function TBDgrid(name, rows, cols,type){
	this.rows = rows;
	this.cols = cols;
	this.thumb = 0;
	this.name = name;
	this.notes = {
		on: [],
		off: []
	}
for(i = 0;i<columns;i++){
 	this.notes.on.push([]);
 	this.notes.off.push([]);
 }
	this.out=0;
	this.type = type;
	if(type.rows){
		this.rows = type.rows;
		console.log(this.rows);
	}

	if(type.melodic){
		console.log('Generating scale!');
		var scaleLen = type.scale.length;
		//repeats the scale while moving up octaves
		for(i = 0; i <this.rows; i++){
			var octave = Math.floor(i/scaleLen);
			this.type.midiNotes.push(rootNote + type.scale[i%scaleLen]+ (12*octave))
		}
		//uses the notes to create the note labels
		for(i = 0;i < this.rows;i++){
			this.type.labels.push(findNoteFromNumber(this.type.midiNotes[i]));

		}
	}

	this.update = function($el){
		var col = $el.index();
		var row = $el.parent().index();
		var thisMidiNote = type.midiNotes[rows-row-1];
		var onIx = this.notes.on[col].indexOf(thisMidiNote);
		var offIx = this.notes.off[(col+1)%this.cols].indexOf((type.midiNotes[rows-row-1]));

		if($el.hasClass('left') && $el.hasClass('right')){
			if(onIx == -1){this.notes.on[col].push(thisMidiNote);}
			if(offIx == -1){this.notes.off[(col+1)%columns].push(thisMidiNote);}
		}else if($el.hasClass('left')){
			if(onIx == -1){this.notes.on[col].push(thisMidiNote);}
		}else if($el.hasClass('right')){
			if(offIx == -1){this.notes.off[(col+1)%columns].push(thisMidiNote);}
		}else{
			if(onIx>-1){
					this.notes.on[col].splice(onIx,1);
			}
			if(offIx>-1){
					this.notes.off[(col+1)%this.cols].splice(offIx,1);
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

	this.clear = function(ix){
		this.notes.on = [];
		this.notes.off = [];
		for(i = 0; i<columns; i++){
			this.notes.on.push([]);
			this.notes.off.push([]);
		}
		$(".gridContainer:eq("+ix+")").find(".clicked").removeClass("clicked left right");
		$(".little.selected").find(".clicked").removeClass("clicked");
	}




	// initial values

	$('ul.tabs li a').removeClass('selected');
	$('.tab-content').removeClass('selected');
		//Create Tab
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

function findNoteFromNumber(num){
	var theNote = noteNames[num%12];
	octave = Math.floor(num/12) - 1;
	return theNote+octave;
}

function isAnOnset(ix,row,col){
	var $thisStep = $('.gridContainer:eq('+ix+') .row:eq('+row+') .step:eq('+col+')');
	if($thisStep.hasClass('left')){
		return true;
	}else{
		return false;
	}

}

function isAnOffset(ix,row,col){
	var $thisStep = $('.gridContainer:eq('+ix+') .row:eq('+row+') .step:eq('+col+')');
	if($thisStep.hasClass('right')){
		return true;
	}else{
		return false;
	}
}

function remove(note, array){
	var index = array.indexOf(note);
	if(index > -1){
    array.splice(index, 1);
	}
	return array;
}

// $(".gridContainer:eq("+data.inst+") .row:eq("+data.row+") .step:eq("+data.column+")");
