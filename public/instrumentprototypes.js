var drums = {
	midiNotes: [36,38,40,39,42,44,46,47,45,49,51,56],
	labels:['kick','snare','snare2','clap','closed hat','pedal hat','open hat','mid tom','low tom','crash','ride','bell'],
	rows: 12,
	melodic: 0
}

var majorScale = {
	midiNotes: [],
	scale: [0,2,4,5,7,9,11],
	labels: [],
	rows: 0,
	melodic: 1
}

var minorScale = {
	midiNotes: [],
	scale: [0,2,3,5,7,8,10],
	labels: [],
	rows: 0,
	melodic: 1
}

var bluesScale = {
	midiNotes: [],
	scale: [0,3,5,6,7,9,10],
	labels: [],
	rows: 0,
	melodic: 1
}


var fullGrid = {
	midiNotes: [],
	labels: [],
	rows: 0,
	melodic: 1
}

var polyphonic = {
	midiNotes: [],
	scale: [[0,4,7],[2,5,9],[4,7,11],[5,9,12],[7,11,14],[9,12,17],[11,14,17]],
	labels: ['M','m','m','M','M','m','d'],
	melodic: 1
}

var presets = [drums,majorScale,minorScale,bluesScale,fullGrid,polyphonic];
