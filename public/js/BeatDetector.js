DANSA.BeatDetector = function(){
	this.bpm = 0;
	this.bps = 0;
	//this.offset = 0;
	this.timeValues = [];
};

DANSA.BeatDetector.prototype.reset = function(){
	this.timeValues.length = this.bps = this.bpm = 0;
};

DANSA.BeatDetector.prototype.addQuarter = function(time){
	if(time < this.timeValues[this.timeValues.length - 1]){
		this.reset();
	}

	this.timeValues.push(time);

	// Update bpm
	var bpsSum = 0;
	for (var i = 1; i < this.timeValues.length; i++) {
		var t0 = this.timeValues[i - 1] - this.timeValues[0];
		var t1 = this.timeValues[i] - this.timeValues[0];
		var bps = 1 / (t1 - t0);
	}
	this.bps = (this.timeValues.length - 1) / (time - this.timeValues[0]);
	this.bpm = this.bps * 60;
};