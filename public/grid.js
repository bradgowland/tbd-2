var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function TBDgrid(name, rows, cols,type){
	this.rows = rows;
	this.cols = cols;
	this.name = name;
	this.notes = [];
	this.notesToOff = [];
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
	// this.createScale = function (this.type.midiNotes){

	// }
	// Gathers value to be sent to note off
	this.updateNotes = function (row,col){
		if(this.poleGrid[row][col]>0){
			console.log(row);

		this.notes[col].push((type.midiNotes[rows-row-1]));
		this.notesToOff[(col+1)%this.cols].push((type.midiNotes[rows-row-1]));

		}else{
		searchIx = this.notes[col].indexOf((type.midiNotes[rows-row-1]));
		this.notes[col].splice(searchIx,1);
		this.notesToOff[(col+1)%this.cols].splice(searchIx,1);
		}

	}

	this.connection = function(grid, index){
		this.poleGrid = grid;
		for (var i = 0; i < grid.length ; i++) {
				for (var j = 0; j < columns; j++) {
					if (grid[i][j] > 0) {
						$(".gridContainer:eq("+index+") .row:eq("+i+") .step:eq("+j+")").toggleClass("clicked");
						this.notes[j].push((type.midiNotes[rows-i-1]));
						this.notesToOff[(j+1)%this.cols].push((type.midiNotes[rows-i-1]));
					}
				}
			}
	}

	this.clear = function(ix){
		this.poleGrid = createGrid(rows,columns);
		this.notes = [];
		this.notesToOff=[];
		for(i = 0; i<columns; i++){
			this.notes.push([]);
			this.notesToOff.push([]);
		}
		$(".gridContainer:eq("+ix+")").find(".clicked").removeClass("clicked");

	}

	this.clicked = function(row,col){
		this.poleGrid[row][col]*=-1;
	}



	// initial values

	$('ul.tabs li a').removeClass('selected');
	$('.tab-content').removeClass('selected');
		//Create Tab
	//Creates the Instrument Tag Link
	var newTab = '<li><a class="tab-link selected" data-tab="'+name+'">'+name+'  <input type="image" class="deletetab" src="littlex.png"></input></a></li>';
	$('.tabs').append(newTab);

	//Creating The Tab Pane
	var newPane = $('<div class="tab-content selected" id="'+name+'"></div>');
	var gc = $('<div class="gridContainer"></div>').appendTo(newPane);
	newPane.appendTo($('#tab-spot'));


	// Setting flexible grid dimensions
	var w = 100/columns;
	var h = 100/this.rows;


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
		for(var k = 0; k < columns; k++){
			row.append("<div class='step'></div>");
		}
	}
	gc.append(gr);

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
	this.poleGrid = createGrid(this.rows,columns);
	for(i = 0;i<columns;i++){
		this.notes.push([]);
		this.notesToOff.push([]);
	}

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
