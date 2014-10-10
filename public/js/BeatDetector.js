DANSA.BeatDetector = function(){
	this.bpm = 0;
	this.bps = 0;
	//this.offset = 0;
	this.timeValues = [];
};

DANSA.BeatDetector.prototype.reset = function(){
	this.timeValues = this.bps = this.bpm = 0;
};

DANSA.BeatDetector.prototype.addQuarter = function(time){
	this.timeValues.push(time);

	// Update bpm
	var bpsSum = 0;
	for (var i = 1; i < this.timeValues.length; i++) {
		var t0 = this.timeValues[i - 1] - this.timeValues[0];
		var t1 = this.timeValues[i] - this.timeValues[0];
		var bps = 1 / (t1 - t0);
		bpsSum += bps;
	}
	this.bps = bpsSum / (this.timeValues.length - 1);
	this.bpm = this.bps * 60;
};