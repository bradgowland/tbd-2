function TBDgrid(name, rows, cols){
	this.rows = rows;
	this.cols = cols;
	this.name = name;
	this.notes = [];
	this.out=0;
	this.clear = function(ix){
		this.poleGrid = createGrid(rows,columns);
	}
	// Create the polarity grid for click/unclick
	this.poleGrid = createGrid(rows,columns);

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
