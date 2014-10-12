DANSA.Note = function(options){
	this.type = typeof(options.type) !== 'undefined' ? options.type : DANSA.Note.Types.TAP;
	this.beat = typeof(options.beat) !== 'undefined' ? options.beat : 0;
	this.column = typeof(options.column) !== 'undefined' ? options.column : 0;
	this.score = typeof(options.score) !== 'undefined' ? options.score : 0;
	this.passed = typeof(options.passed) !== 'undefined' ? options.passed : false;
};

DANSA.Note.Types = {
	TAP: 1, // a regular "tap note"
	HOLD_START: 2, // beginning of a "hold note"
	HOLD_END: 3, // end of a "hold note"
	ROLL: 4, // beginning of a roll
	MINE: 5, // Mine
	LIFT: 6, // Lift
};