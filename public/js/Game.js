
// RequestAnimation shim
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

DANSA.Game = function(options){
    options = options || {};

    DANSA.EventEmitter.call(this);

    var that = this;

    this.imgDir = options.imgDir || '/img';

    this.isSupported = !!document.createElement('audio').canPlayType;
    this.supportedMessage = null;
    if (!this.isSupported) {
        this.supportedMessage = "Your browser doesn't support the HTML5 audio tag.";
    }

    var el = document.createElement('CANVAS');
    el.width = options.width || 320;
    el.height = options.height || 480;
    this.domElement = el;

    this.context = el.getContext("2d");
    this.scrollSpeed = options.scrollSpeed || 2;
    this.notes = [];
    this.bpm = options.bpm || 70;
    this.offsetSeconds = options.offsetSeconds || 0;
    this.currentTime = 0;
    this.playing = false;

    this.lastNow = performance.now();
    this.uptimeSeconds = 0;
    this.framesInCurrentSecond = 0;
    this.arrowSize = 64;
    this.songEnd = false;

    this.loop = false;
    this.loopStartBeat = 0;
    this.loopNumBeats = 4;

    this.colInfos = [
        { x: 64 + 64 * 0, y: 32*2, rotation: 90 },
        { x: 64 + 64 * 1, y: 32*2, rotation: 0 },
        { x: 64 + 64 * 2, y: 32*2, rotation: 180 },
        { x: 64 + 64 * 3, y: 32*2, rotation: -90 },
    ];

    this.targetsY = 32 * 2;

    this.timingWindowSeconds = [0.03, 0.06, 0.09, 0.12, 0.15];
    this.tapNotePoints = [3, 3, 2, 1, 0, -5];

    this.tapNoteScores = [0, 0, 0, 0, 0, 0];
    this.numTapNoteScores = 0;
    this.actualPoints = 0;
    this.possiblePoints = 3 * this.notes.length;
    this.currentCombo = 0;
    this.maxCombo = 0;
    this.points = 0;

    this.targets = [];
    for (var i = 0; i < this.colInfos.length; i++) {
        var colInfo = this.colInfos[i];
        this.targets.push(new DANSA.Actor(this.context, this.imgDir + "/down-target.png", { frameWidth: 64, frameHeight: 64, numFrames: 3 }, colInfo));
    }

    this.explosions = [];
    for (var i = 0; i < this.colInfos.length; i++) {
        var colInfo = this.colInfos[i];
        var target = new DANSA.Actor(this.context, this.imgDir + "/down-explosion.png", { frameWidth: 64, frameHeight: 64, numFrames: 1 }, colInfo);
        this.explosions.push(target);
        target.set({ alpha: 0 }); // why not just pass in constructor?
    }

    this.judgment = new DANSA.Actor(this.context, this.imgDir + "/judgment.png", {
        frameWidth: 168,
        frameHeight: 28,
        numFrames: 6
    }, {
        x: 160,
        y: 160
    });
    this.judgment.set({ alpha: 0 });

    this.noteSprite = DANSA.Sprite(this.imgDir + "/down-note.png", {
        frameWidth: 64,
        frameHeight: 64,
        numFrames: 16
    });
    this.barSprite = DANSA.Sprite(this.imgDir + "/bar.png", {
        frameWidth: 1,
        frameHeight: 10,
        numFrames: 1
    });

    this.frame = options.frame || null;

    this.autoSync = false;
    this.autoSyncOffByHistory = [];
    this.autoSyncSampleSize = 20;
    this.autosyncDampeningFactor = 0.5;

    this.audioElement = document.createElement('AUDIO');
    this.lastCurrentTime = 0;
    this.lastTime = performance.now() / 1000;
    this.dTime = 1;
    this.audioElement.addEventListener('timeupdate', function (evt){
        that.playing = true;
        var now = performance.now() / 1000;
        that.dTime = (that.audioElement.currentTime - that.lastCurrentTime) / (now - that.lastTime);
        that.lastTime = now;
        that.lastCurrentTime = that.audioElement.currentTime;
        that.messageFrame({
            type: 'timeupdate',
            time: that.lastCurrentTime,
            addToMusicPositionSeconds: that.offsetSeconds,
            beatsPerSec: that.bpm / 60,
            songEnd: that.songEnd
        });
    });

    this.input = new DANSA.GameInput();

    this.startLoop();
    if(options.audioURI){
        this.setAudioURI(options.audioURI);
        this.play();
    }

    var key2col = {};
    key2col[DANSA.GameInput.Keys.LEFT] = 0;
    key2col[DANSA.GameInput.Keys.DOWN] = 1;
    key2col[DANSA.GameInput.Keys.UP] = 2;
    key2col[DANSA.GameInput.Keys.RIGHT] = 3;
    this.input.on('keydown', function (evt){
        var col = key2col[evt.button];
        that.handleStep(col);
    });

    this.incomingAngle = 0;
    $(window).keydown(function (event) {
        var activeName = document.activeElement.nodeName;
        if(activeName === 'INPUT' || activeName === 'TEXTAREA'){
            return;
        }
        var keyCode = event.which;
        var col = -1;
        switch (keyCode) {
            // case 65/*d*/: case 37: col = 0; break;
            // case 87/*w*/: case 38: col = 2; break;
            // case 68/*d*/: case 39: col = 3; break;
            // case 83/*s*/: case 40: col = 1; break;
            case 220/*back slash*/: that.autoSync = !that.autoSync; break;
            case 219/*open bracket*/: that.adjustSync(-0.01); break;
            case 221/*close bracket*/: that.adjustSync(0.01); break;
            case 49/*1*/: that.scrollSpeed=1; break;
            case 50/*2*/: that.scrollSpeed=2; break;
            case 51/*3*/: that.scrollSpeed=3; break;
            case 52/*4*/: that.scrollSpeed=4; break;
            case 53/*5*/:
                that.incomingAngle = that.incomingAngle === 0 ? -30 : 0;
                that.setIncoming(that.incomingAngle);
                break;
            case 188/*,*/:
                if(that.beatDetector){
                    console.log('reset beatdetector');
                    that.beatDetector.reset();
                }
                break;
            case 190/*.*/:
                if(!that.beatDetector){
                    that.beatDetector = new DANSA.BeatDetector();
                }
                that.beatDetector.addQuarter(that.currentTime);
                if(!isNaN(that.beatDetector.bpm))
                    console.log('BPM:', that.beatDetector.bpm);
                break;
            case 82/*r*/:
                that.goToTime(0);
                break;
        }

        if (col !== -1) {
            that.handleStep(col);
            event.preventDefault();
        }
    });
};

DANSA.Game.prototype = new DANSA.EventEmitter();

/**
 * Parse note data.
 * @param  {object} data
 * @return {boonean}
 */
DANSA.Game.prototype.parseNotes = function(data) {
    if(!data) return false;

    if(Array.isArray(data.noteData)){
        // Data from sm-micro

        // Validate
        for (var i = 0; i < data.noteData.length; i++) {
            var noteData = data.noteData[i];

            if(
                !Array.isArray(noteData) ||
                typeof(noteData[0]) !== 'number' ||
                typeof(noteData[1]) !== 'number' ||
                typeof(noteData[2]) !== 'object'
            ){
                return false;
            }
        }

        // Insert
        this.notes.length = 0;
        for (var i = 0; i < data.noteData.length; i++) {
            var noteData = data.noteData[i];
            var note = new DANSA.Note({
                beat: noteData[0],
                column: noteData[1],
                type: DANSA.Note.Types.TAP
            });
            this.notes.push(note);
        }

        return true;
    }


    if(Array.isArray(data) && Array.isArray(data[0]) && typeof(data[0][0]) === 'string'){
        // new dansa data

        // Validate
        var reg = /^[0-3ML]{4}$/;
        for (var i = 0; i < data.length; i++) {
            var measure = data[i];

            // Measure must be a multiple of 4
            if(measure.length % 4 !== 0){
                return false;
            }

            for (var j = 0; j < measure.length; j++) {
                var steps = measure[j];

                if(!steps.match(reg)){
                    return false;
                }
            }
        }

        // Insert
        this.notes.length = 0;
        for (var i = 0; i < data.length; i++) {
            var measure = data[i];

            for (var j = 0; j < measure.length; j++) {
                var steps = measure[j];

                for (var column = 0; column < steps.length; column++) {
                    var type = -1;
                    switch(steps[column]){
                    case '1': type = DANSA.Note.Types.TAP; break;
                    case '2': type = DANSA.Note.Types.HOLD_START; break;
                    case '3': type = DANSA.Note.Types.HOLD_END; break;
                    case 'M': type = DANSA.Note.Types.MINE; break;
                    case 'L': type = DANSA.Note.Types.LIFT; break;
                    }

                    if(type === -1){
                        continue;
                    }

                    var note = new DANSA.Note({
                        beat: i * 4 + 4 / measure.length * j,
                        column: column,
                        type: DANSA.Note.Types.TAP
                    });

                    this.notes.push(note);
                }
            }
        }
        return true;
    }
};

DANSA.Game.prototype.setIncoming = function(angleDegrees) {
    if(typeof(angleDegrees) == 'undefined'){
        angleDegrees = -30;
    }
    $(this.domElement).css({
        'transform' : 'rotateX(' + angleDegrees + 'deg)',
        '-ms-transform' : 'rotateX(' + angleDegrees + 'deg)',
        '-moz-transform' : 'rotateX(' + angleDegrees + 'deg)',
        '-webkit-transform' : 'rotateX(' + angleDegrees + 'deg)',
        '-o-transform' : 'rotateX(' + angleDegrees + 'deg)'
    });
};

DANSA.Game.prototype.messageFrame = function(message) {
    if(this.frame){
        this.frame.contentWindow.postMessage(message, '*');
    }
};

DANSA.Game.prototype.goToBeat = function(beat) {
    var time = this.beatToSecond(beat);
    this.goToTime(time);
};

DANSA.Game.prototype.goToTime = function(time) {
    this.lastCurrentTime = time - 1 / 60;
    this.lastTime = performance.now() / 1000;
    this.lastNow = performance.now();
    this.dTime = 1;
    this.currentTime = time;
    this.numTapNoteScores = 0;
    this.points = 0;
    this.currentCombo = 0;
    this.maxCombo = 0;

    for(var i=0; i<this.notes.length; i++){
        var note = this.notes[i];
        note.passed = false;
        note.score = 0;
    }

    if(this.audioElement.readyState >= 1){
        this.audioElement.currentTime = this.currentTime;
    }
};

DANSA.Game.prototype.startLoop = function() {
    var that = this;
    (function animloop(){
        requestAnimFrame(animloop);
        var now = performance.now();
        var deltaSeconds = (now - that.lastNow) / 1000;
        that.updateInternal(deltaSeconds);
        that.draw();
        that.lastNow = now;
    })();
};

DANSA.Game.prototype.handleStep = function(col) {
    var hit = false;
    var tapNoteScore = 0;
    for (var i = 0; i < this.notes.length; i++) {
        var note = this.notes[i];
        var noteBeat = note.beat;
        var noteCol = note.column;

        if (note.passed)
            continue;

        if (noteCol != col)
            continue;

        var offBySec = this.currentTime - this.beatToSecond(noteBeat);
        var offBySecAbs = Math.abs(offBySec);

        if (offBySecAbs >= this.timingWindowSeconds[this.timingWindowSeconds.length - 1])
            continue;

        for (var j = 0; j < this.timingWindowSeconds.length; j++) {
            if (offBySecAbs <= this.timingWindowSeconds[j]) {

                note.score = j;
                note.passed = true;
                tapNoteScore = j;
                break;
            }
        }

        if (this.autoSync){
            this.handleAutoSync(offBySec);
        }

        hit = true;
        //$('#note' + i).css({ alpha: 0 });
    }
    if (hit) {
        this.handleTapNoteScore(tapNoteScore);

        this.explosions[col]
            .stop()
            .set({ scaleX: 1, scaleY: 1, alpha: 1 })
            .animate({ scaleX: 1.1, scaleY: 1.1 }, 0.1)
            .animate({ alpha: 0 }, 0.1);
    } else {
        this.targets[col]
            .stop()
            .set({ scaleX: 0.5, scaleY: 0.5 })
            .animate({ scaleX: 1, scaleY: 1 }, 0.2);
    }
};

DANSA.Game.prototype.secondToBeat = function(offBySec) {
    this.autoSyncOffByHistory[this.autoSyncOffByHistory.length] = offBySec;
    if (this.autoSyncOffByHistory.length > this.autoSyncSampleSize) {

        var avgOffBy = 0;
        for (var j = 0; j < this.autoSyncOffByHistory.length; j++) {
            avgOffBy += this.autoSyncOffByHistory[j];

            var adjustBy = Math.round(avgOffBy * -1) * this.autosyncDampeningFactor;
            this.adjustSync(adjustBy);

            this.autoSyncOffByHistory.length = 0;
        }
    }
};

DANSA.Game.prototype.secondToBeat = function(musicSec) {
    return (musicSec + this.offsetSeconds) * (this.bpm / 60);
};

DANSA.Game.prototype.beatToSecond = function(beat) {
    return (beat / (this.bpm / 60)) - this.offsetSeconds;
};

DANSA.Game.prototype.adjustSync = function(deltaSeconds) {
    this.offsetSeconds += deltaSeconds;
};

DANSA.Game.prototype.handleTapNoteScore = function(tapNoteScore) {
    this.tapNoteScores[tapNoteScore]++;
    this.numTapNoteScores++;

    // $("#w" + tapNoteScore).text(tapNoteScores[tapNoteScore]);

    this.points += this.tapNotePoints[tapNoteScore];
    var percent = this.points / this.possiblePoints * 100;
    // $("#percent-score").text(percent.toFixed(2) + "%");

    if (tapNoteScore < 3) {
        this.currentCombo++;
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
            // $("#max-combo").text(maxCombo);
        }
    } else {
        this.currentCombo = 0;
    }

    if (tapNoteScore === 5) {
        this.judgment
            .stop()
            .set({ frameIndex: tapNoteScore, scaleX: 1, scaleY: 1, y: 160, alpha: 1 })
            .animate({ y: 210 }, 0.5)
            .animate({ alpha: 0 }, 0);
    } else {
        this.judgment
            .stop()
            .set({ frameIndex: tapNoteScore })
            .animate({ scaleX: 1.4, scaleY: 1.4, alpha: 1 }, 0)
            .animate({ scaleX: 1, scaleY: 1 }, 0.1)
            .animate({ scaleX: 1, scaleY: 1 }, 0.5)
            .animate({ alpha: 0 }, 0.2);
    }

    if (this.numTapNoteScores == this.notes.length){
        //saveHighScore(percent);
        this.songEnd = true;
    }
};

DANSA.Game.prototype.update = function() {
    var now = performance.now();
    var deltaSeconds = (now - this.lastNow) / 1000;
    this.updateInternal(deltaSeconds);
    this.draw();
    this.lastNow = now;
};

DANSA.Game.prototype.play = function() {
    this.audioElement.play();
};

DANSA.Game.prototype.setAudioURI = function(uri) {
    this.audioElement.src = uri;
};

DANSA.Game.prototype.updateInternal = function(deltaSeconds) {

    // Read input
    this.input.update();

    // Extrapolate the last time value we got from the audio
    //if(this.playing){
        this.currentTime = this.lastCurrentTime + this.dTime * (performance.now() / 1000 - this.lastTime);
    //}

    // Check if we should go back to loop start
    var beat = this.secondToBeat(this.currentTime);
    var lastCurrentTimeBeat = this.secondToBeat(this.lastCurrentTime);
    if(this.loop && beat > this.loopStartBeat + this.loopNumBeats){
        /*
        this.currentTime = this.beatToSecond(beat - this.loopNumBeats);
        this.lastCurrentTime = -(performance.now() / 1000 - this.lastTime) * this.dTime + this.currentTime;
        */
        this.goToBeat(beat - this.loopNumBeats);
        //if(this.audioElement.readyState >= 1) // Seekable
        //    this.audioElement.currentTime = this.currentTime;
    }

    if(Math.floor(beat) !== this.beat){
        this.emit({ type: 'beat' });
    }
    this.beat = Math.floor(beat);

    var i;
    for(i = 0; i < this.targets.length; i++){
        this.targets[i].update(deltaSeconds);
    }

    for(i = 0; i < this.explosions.length; i++){
        this.explosions[i].update(deltaSeconds);
    }

    this.judgment.update(deltaSeconds);

    var missIfOlderThanSeconds = this.currentTime - this.timingWindowSeconds[this.timingWindowSeconds.length - 1];
    var missIfOlderThanBeat = this.secondToBeat(missIfOlderThanSeconds);

    this.numMisses = 0;
    for(i = 0; i < this.notes.length; i++){
        var note = this.notes[i];
        var noteBeat = note.beat;
        if (noteBeat < missIfOlderThanBeat) {
            if (!note.passed) {
                this.numMisses++;
                note.score = 5;
                note.passed = true;
                this.handleTapNoteScore(5);
            }
        }
    }
};

DANSA.Game.prototype.draw = function() {

    // TODO: don't clear whole
    this.context.clearRect(0, 0, this.domElement.width, this.domElement.height);

    for(var i=0; i<this.targets.length; i++){
        this.targets[i].draw();
    }

    for(var i=0; i<this.explosions.length; i++){
        this.explosions[i].draw();
    }

    this.drawNoteField();
    this.judgment.draw();
    this.drawLifeBar();
};

DANSA.Game.prototype.drawLifeBar = function() {
    var maxBarWidth = this.domElement.width;
    var life = this.points / this.possiblePoints;
    var barWidth = life * maxBarWidth;
    barWidth = barWidth > 0 ? barWidth : 0;
    this.barSprite.draw(this.context, 0, barWidth / 2, 32/2 - 12, barWidth, 3, 0, 1);
};

DANSA.Game.prototype.drawNoteField = function() {
    var musicBeat = this.secondToBeat(this.currentTime);

    var scrollSpeed = this.scrollSpeed;
    var arrowSpacing = this.arrowSize * scrollSpeed;
    var distFromNearestBeat = Math.abs(musicBeat - Math.round(musicBeat));
    var lit = distFromNearestBeat < 0.1;

    for(var i = 0; i < this.targets.length; i++){
        var target = this.targets[i];
        target.props.frameIndex = lit ? 0 : 1;
    }
    var animateOverBeats = 4;
    var musicBeatRemainder = musicBeat % animateOverBeats;
    var percentThroughAnimation = musicBeatRemainder / animateOverBeats;
    var numNoteFrames = 16;
    var noteFrameIndex = percentThroughAnimation * numNoteFrames;

    for (var i = 0; i < this.notes.length; i++) {
        var note = this.notes[i];
        var beat = note.beat;
        var col = note.column;
        var colInfo = this.colInfos[col];
        var beatUntilNote = beat - musicBeat;

        var onScreen = beatUntilNote < 8.2 / scrollSpeed && beatUntilNote > -1.6 / scrollSpeed;
        // var needUpdateOnScreen = note.lastOnScreen == null || onScreen != note.lastOnScreen;

        if (onScreen) {
            var beatFraction = beat - Math.floor(beat);
            var frameOffset = beatFraction * numNoteFrames;
            var thisNoteFrameIndex = Math.round(noteFrameIndex + frameOffset) % numNoteFrames;
            var y = this.targetsY + beatUntilNote * arrowSpacing;
            var alpha = 1;
            if (note.passed) {
                if (note.score < 5){
                    alpha = 0;
                }
            }
            this.noteSprite.draw(this.context, thisNoteFrameIndex, colInfo.x, y, 1, 1, colInfo.rotation, alpha);
        }
    }
};
