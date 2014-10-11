
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

    var that = this;

    this.imgDir = options.imgDir || '/img';

    this.isSupported = !!document.createElement('audio').canPlayType;
    this.supportedMessage = null;
    if (!this.isSupported) {
        this.supportedMessage = "Your browser doesn't support the HTML5 audio tag.";
    }

    var el = document.createElement('CANVAS');
    el.width = options.width || 320;
    el.height = options.height || window.innerHeight;
    this.domElement = el;

    this.context = el.getContext("2d");
    this.scrollSpeed = options.scrollSpeed || 2;
    this.notes = options.notes || [];
    this.bpm = options.bpm || 70;
    this.offsetSeconds = options.offsetSeconds || 0;
    this.currentTime = 0;

    this.lastNow = performance.now();
    this.uptimeSeconds = 0;
    this.framesInCurrentSecond = 0;
    this.arrowSize = 64;
    this.songEnd = false;

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
    this.possiblePoints = 3 * steps.noteData.length;
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
    this.audioElement.addEventListener('timeupdate', function(evt){
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

    this.startLoop();
    if(options.audioURI){
        this.setAudioURI(options.audioURI);
        this.play();
    }


    $(window).keydown(function (event) {
        var keyCode = event.which;
        var col = -1;
        switch (keyCode) {
            case 65/*d*/: case 37: col = 0; break;
            case 87/*w*/: case 38: col = 2; break;
            case 68/*d*/: case 39: col = 3; break;
            case 83/*s*/: case 40: col = 1; break;
            case 220/*back slash*/: that.autoSync = !that.autoSync; break;
            case 219/*open bracket*/: that.adjustSync(-0.01); break;
            case 221/*close bracket*/: that.adjustSync(0.01); break;
            case 49/*1*/: that.scrollSpeed=1; break;
            case 50/*2*/: that.scrollSpeed=2; break;
            case 51/*3*/: that.scrollSpeed=3; break;
            case 52/*4*/: that.scrollSpeed=4; break;
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
    this.lastCurrentTime = 0;
    this.lastTime = performance.now() / 1000;
    this.lastNow = performance.now();
    this.dTime = 1;
    this.audioElement.currentTime = this.currentTime = 0;
    this.numTapNoteScores = 0;
    this.points = 0;
    this.currentCombo = 0;
    this.maxCombo = 0;

    for(var i=0; i<this.notes.length; i++){
        var note = this.notes[i];
        delete note[2].tapNoteScore;
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
        var noteBeat = note[0];
        var noteCol = note[1];
        var noteProps = note[2];

        if ("tapNoteScore" in noteProps)
            continue;

        if (noteCol != col)
            continue;

        var offBySec = this.currentTime - this.beatToSecond(noteBeat);
        var offBySecAbs = Math.abs(offBySec);

        if (offBySecAbs >= this.timingWindowSeconds[this.timingWindowSeconds.length - 1])
            continue;

        for (var j = 0; j < this.timingWindowSeconds.length; j++) {
            if (offBySecAbs <= this.timingWindowSeconds[j]) {

                noteProps.tapNoteScore = j;
                tapNoteScore = j;
                break;
            }
        }

        if (this.autoSync)
            this.handleAutoSync(offBySec);

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

    if (tapNoteScore == 5) {
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

    // Extrapolate the last time value we got from the audio
    this.currentTime = this.lastCurrentTime + this.dTime * (performance.now() / 1000 - this.lastTime);

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
        var noteBeat = note[0];
        var noteProps = note[2];
        if (noteBeat < missIfOlderThanBeat) {
            if (!("tapNoteScore" in noteProps)) {
                this.numMisses++;
                noteProps.tapNoteScore = 5;
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
        var beat = note[0];
        var col = note[1];
        var noteProps = note[2];
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
            if ("tapNoteScore" in noteProps) {
                if (noteProps.tapNoteScore < 5)
                    alpha = 0;
            }
            this.noteSprite.draw(this.context, thisNoteFrameIndex, colInfo.x, y, 1, 1, colInfo.rotation, alpha);
        }
    }
};

function merge(o1, o2) {
    for (var attr in o2) {
        o1[attr] = o2[attr];
    }
}

function deepCopy(o) {
    var ret = {};
    merge(ret, o);
    return ret;
}

/*
var CANVAS_WIDTH = 320;
var CANVAS_HEIGHT = window.innerHeight;

var canvasElement = $("<canvas width='" + CANVAS_WIDTH + "' height='" + CANVAS_HEIGHT + "'></canvas>");
var canvas = canvasElement.get(0).getContext("2d");
canvasElement.prependTo('#sm-micro');

*/
function startGame(){
    return;

    var scrollSpeed = 2;
    var noteData = steps.noteData;
    var bpm = song.bpm;
    var beatsPerSec = bpm / 60;
    var addToMusicPositionSeconds = song.addToMusicPosition;

    var currentTime = 0;
    function secondToBeat(musicSec) {
        return (musicSec + addToMusicPositionSeconds) * beatsPerSec;
    }
    function beatToSecond(beat) {
        return (beat / beatsPerSec) - addToMusicPositionSeconds;
    }


    var audio = document.getElementById('audio_with_controls');

    var lastNow = performance.now();
    var uptimeSeconds = 0;
    var framesInCurrentSecond = 0;
    var arrowSize = 64;
    var songEnd = false;

    var colInfos = [
        { x: 64 + 64 * 0, y: 32*2, rotation: 90 },
        { x: 64 + 64 * 1, y: 32*2, rotation: 0 },
        { x: 64 + 64 * 2, y: 32*2, rotation: 180 },
        { x: 64 + 64 * 3, y: 32*2, rotation: -90 },
    ];

    var targetsY = 32 * 2;

    var timingWindowSeconds = [0.03, 0.06, 0.09, 0.12, 0.15];
    var tapNotePoints = [3, 3, 2, 1, 0, -5];

    var tapNoteScores = [0, 0, 0, 0, 0, 0];
    var numTapNoteScores = 0;
    var actualPoints = 0;
    var possiblePoints = 3 * noteData.length;
    var currentCombo = 0;
    var maxCombo = 0;

    /*
    function saveHighScore(percent) {
        var loadUrl = "/api.php?action=upload_score";
        $.post(loadUrl, {
            percent: actualPoints / possiblePoints * 100,
            chart_id: chartId,
            max_combo: maxCombo });
    }
    */

    function handleTapNoteScore(tapNoteScore) {
        tapNoteScores[tapNoteScore]++;
        numTapNoteScores++;

        // $("#w" + tapNoteScore).text(tapNoteScores[tapNoteScore]);

        actualPoints += tapNotePoints[tapNoteScore];
        var percent = actualPoints / possiblePoints * 100;
        // $("#percent-score").text(percent.toFixed(2) + "%");

        if (tapNoteScore < 3) {
            currentCombo++;
            if (currentCombo > maxCombo) {
                maxCombo = currentCombo;
                // $("#max-combo").text(maxCombo);
            }
        } else {
            currentCombo = 0;
        }

        if (tapNoteScore == 5) {
            judgment
                .stop()
                .set({ frameIndex: tapNoteScore, scaleX: 1, scaleY: 1, y: 160, alpha: 1 })
                .animate({ y: 210 }, 0.5)
                .animate({ alpha: 0 }, 0);
        } else {
            judgment
                .stop()
                .set({ frameIndex: tapNoteScore })
                .animate({ scaleX: 1.4, scaleY: 1.4, alpha: 1 }, 0)
                .animate({ scaleX: 1, scaleY: 1 }, 0.1)
                .animate({ scaleX: 1, scaleY: 1 }, 0.5)
                .animate({ alpha: 0 }, 0.2);
        }

        if (numTapNoteScores == noteData.length){
            //saveHighScore(percent);
            songEnd = true;
        }
    }

    targets = [];
    for (var i = 0; i < colInfos.length; i++) {
        var colInfo = colInfos[i];
        targets.push(new Actor("/img/down-target.png", { frameWidth: 64, frameHeight: 64, numFrames: 3 }, colInfo));
    }

    explosions = [];
    for (var i = 0; i < colInfos.length; i++) {
        var colInfo = colInfos[i];
        var target = new Actor("/img/down-explosion.png", { frameWidth: 64, frameHeight: 64, numFrames: 1 }, colInfo);
        explosions.push(target);
        target.set({ alpha: 0 });
    }

    var judgment = new Actor("/img/judgment.png", { frameWidth: 168, frameHeight: 28, numFrames: 6 }, { x: 160, y: 160 });
    judgment.set({ alpha: 0 });
    var noteSprite = Sprite("/img/down-note.png", { frameWidth: 64, frameHeight: 64, numFrames: 16 });
    var barSprite = Sprite("/img/bar.png", { frameWidth: 1, frameHeight: 10, numFrames: 1 });



    function getBrowserAlertText() {
        if ($.browser.mozilla && $.browser.version.substr(0, 3) < 2.0) {
            return "Your version of Firefox is known to have incorrect audio sync. More info...";
        }
        var supportsAudio = !!document.createElement('audio').canPlayType;
        if (!supportsAudio) {
            return "Your browser doesn't support the HTML5 audio tag. More info...";
        }
        return "";
    }



    var text = getBrowserAlertText();
    if (text) {
        $('#alert-message').text(text);
        $('#alert').show();
    } else {
        $('#alert').hide();
    }


    function adjustSync(delta) {
        addToMusicPositionSeconds += delta;
        console.log("adjustSync " + addToMusicPositionSeconds + ", " + delta);
        //$("#offset-row").show();
        //$("#offset").text(addToMusicPositionSeconds.toFixed(2));
    }

    var autoSync = false;
    function toggleAutosync() {
        autoSync = !autoSync;
        console.log('autoSync',autoSync);
        //$("#autosync-row").toggle(autoSync);
    }

    var autoSyncOffByHistory = [];
    var autoSyncSampleSize = 20;
    var autosyncDampeningFactor = 0.5;
    function handleAutoSync(offBySec) {
        autoSyncOffByHistory[autoSyncOffByHistory.length] = offBySec;
        if (autoSyncOffByHistory.length > autoSyncSampleSize) {

            var avgOffBy = 0;
            for (var j = 0; j < autoSyncOffByHistory.length; j++) {
                avgOffBy += autoSyncOffByHistory[j];

                var adjustBy = Math.round(avgOffBy * -1) * autosyncDampeningFactor;
                adjustSync(adjustBy);

                autoSyncOffByHistory = [];
            }
        }
    }

    function step(col) {
        var hit = false;
        var tapNoteScore = 0;
        for (var i = 0; i < noteData.length; i++) {
            var note = noteData[i];
            var noteBeat = note[0];
            var noteCol = note[1];
            var noteProps = note[2];

            if ("tapNoteScore" in noteProps)
                continue;

            if (noteCol != col)
                continue;

            var offBySec = currentTime - beatToSecond(noteBeat);
            var offBySecAbs = Math.abs(offBySec);

            if (offBySecAbs >= timingWindowSeconds[timingWindowSeconds.length - 1])
                continue;

            for (var j = 0; j < timingWindowSeconds.length; j++) {
                if (offBySecAbs <= timingWindowSeconds[j]) {

                    noteProps.tapNoteScore = j;
                    tapNoteScore = j;
                    break;
                }
            }

            if (autoSync)
                handleAutoSync(offBySec);

            hit = true;
            //$('#note' + i).css({ alpha: 0 });
        }
        if (hit) {
            handleTapNoteScore(tapNoteScore);

            var explosion = explosions[col];
            explosion
            .stop()
            .set({ scaleX: 1, scaleY: 1, alpha: 1 })
            .animate({ scaleX: 1.1, scaleY: 1.1 }, 0.1)
            .animate({ alpha: 0 }, 0.1);
        } else {
            var target = targets[col];
            target
            .stop()
            .set({ scaleX: 0.5, scaleY: 0.5 })
            .animate({ scaleX: 1, scaleY: 1 }, 0.2);
        }

    }

    var beatDetector;
    $(document).ready(function () {
        /*
        if (window.Touch) {
            $('#button0')[0].ontouchstart = function (e) { step(0); };
            $('#button1')[0].ontouchstart = function (e) { step(1); };
            $('#button2')[0].ontouchstart = function (e) { step(2); };
            $('#button3')[0].ontouchstart = function (e) { step(3); };
        } else {
            $('#button0').click(function (e) { step(0); });
            $('#button1').click(function (e) { step(1); });
            $('#button2').click(function (e) { step(2); });
            $('#button3').click(function (e) { step(3); });
        }
        */

        $(document).keydown(function (event) {
            var anyInputHasFocus = $('input[type]:focus').length > 0;
            if (anyInputHasFocus)
                return;

            var keyCode = event.which;

            var col;
            switch (keyCode) {
                case 65/*d*/: case 37: col = 0; break;
                case 87/*w*/: case 38: col = 2; break;
                case 68/*d*/: case 39: col = 3; break;
                case 83/*s*/: case 40: col = 1; break;
                case 220/*back slash*/: toggleAutosync(); break;
                case 219/*open bracket*/: adjustSync(-0.01); break;
                case 221/*close bracket*/: adjustSync(0.01); break;
                case 49/*1*/: scrollSpeed=1; break;
                case 50/*2*/: scrollSpeed=2; break;
                case 51/*3*/: scrollSpeed=3; break;
                case 52/*4*/: scrollSpeed=4; break;
                case 188/*,*/:
                    if(beatDetector){
                        beatDetector.reset();
                    }
                    break;
                case 190/*.*/:
                    if(!beatDetector){
                        beatDetector = new DANSA.BeatDetector();
                        console.log('reset beatdetector');
                    }
                    beatDetector.addQuarter(currentTime);
                    console.log('BPM:', beatDetector.bpm);
                    break;
                case 82/*r*/:
                    lastCurrentTime = 0;
                    lastTime = performance.now() / 1000;
                    lastNow = performance.now();
                    dTime = 1;
                    audio.currentTime = currentTime = 0;
                    numTapNoteScores = 0;
                    actualPoints = 0;
                    currentCombo = 0;
                    maxCombo = 0;
                    break;
            }

            if (undefined != col) {
                step(col);
                event.preventDefault();
            }
        });
    });

    (function animloop(){
        requestAnimFrame(animloop);
        var now = performance.now();
        var deltaSeconds = (now - lastNow) / 1000;
        update(deltaSeconds);
        draw();
        lastNow = now;
        framesInCurrentSecond++;
        var oldSec = Math.floor(uptimeSeconds);
        var newSec = Math.floor(uptimeSeconds + deltaSeconds);
        if (oldSec != newSec) {
            var fps = framesInCurrentSecond / (newSec - oldSec);
            //$("#FPS").text(fps);
            framesInCurrentSecond = 0;
        }
        uptimeSeconds += deltaSeconds;
    })();

    var lastCurrentTime = 0;
    var lastTime = performance.now() / 1000;
    var dTime = 1;
    audio.addEventListener('timeupdate', function(evt){
        var now = performance.now() / 1000;
        dTime = (audio.currentTime - lastCurrentTime) / (now - lastTime);
        lastTime = now;
        lastCurrentTime = audio.currentTime;

        messageFrame({
            type: 'timeupdate',
            time: lastCurrentTime,
            addToMusicPositionSeconds: addToMusicPositionSeconds,
            beatsPerSec: beatsPerSec,
            songEnd: songEnd
        });
    });

    var useCurrentTimeSmoothing = false;
    var lastSeenCurrentTime = 0;
    function update(deltaSeconds) {

        // Extrapolate the last time value we got from the audio
        currentTime = lastCurrentTime + dTime * (performance.now() / 1000 - lastTime);

        for(var i=0; i<targets.length; i++){
            var target = targets[i];
            target.update(deltaSeconds);
        }
        for(var i=0; i<explosions.length; i++){
            var target = explosions[i];
            target.update(deltaSeconds);
        }
        judgment.update(deltaSeconds);

        var missIfOlderThanSeconds = currentTime - timingWindowSeconds[timingWindowSeconds.length - 1];
        var missIfOlderThanBeat = secondToBeat(missIfOlderThanSeconds);

        numMisses = 0;
        for(var i=0; i<noteData.length; i++){
            var note = noteData[i];
            var noteBeat = note[0];
            var noteProps = note[2];
            if (noteBeat < missIfOlderThanBeat) {
                if (!("tapNoteScore" in noteProps)) {
                    numMisses++;
                    noteProps.tapNoteScore = 5;
                    handleTapNoteScore(5);
                }
            }
        }
    }

    function draw() {
        canvas.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for(var i=0; i<targets.length; i++){
            var target = targets[i];
            target.draw();
        }
        for(var i=0; i<explosions.length; i++){
            var target = explosions[i];
            target.draw();
        }

        drawNoteField();

        judgment.draw();

        drawLifeBar();
    }

    function drawLifeBar(){
        var maxBarWidth = CANVAS_WIDTH;
        var life = actualPoints / possiblePoints;
        var barWidth = life * maxBarWidth;
        barWidth = barWidth > 0 ? barWidth : 0;
        barSprite.draw(canvas, 0, barWidth / 2, 32/2 - 12, barWidth, 3, 0, 1);
    }

    function drawNoteField() {
        var musicBeat = secondToBeat(currentTime);

        var arrowSpacing = arrowSize * scrollSpeed;
        var distFromNearestBeat = Math.abs(musicBeat - Math.round(musicBeat));
        var lit = distFromNearestBeat < 0.1;

        for(var i=0; i<targets.length; i++){
            var target = targets[i];
            target.props.frameIndex = lit ? 0 : 1;
        }
        var animateOverBeats = 4;
        var musicBeatRemainder = musicBeat % animateOverBeats;
        var percentThroughAnimation = musicBeatRemainder / animateOverBeats;
        var numNoteFrames = 16;
        var noteFrameIndex = percentThroughAnimation * numNoteFrames;

        for (var i = 0; i < noteData.length; i++) {
            var note = noteData[i];
            var beat = note[0];
            var col = note[1];
            var noteProps = note[2];
            var colInfo = colInfos[col];
            var beatUntilNote = beat - musicBeat;

            var onScreen = beatUntilNote < 8.2 / scrollSpeed && beatUntilNote > -1.6 / scrollSpeed;
            var needUpdateOnScreen = note.lastOnScreen == null || onScreen != note.lastOnScreen;

            if (onScreen) {
                var beatFraction = beat - Math.floor(beat);
                var frameOffset = beatFraction * numNoteFrames;
                var thisNoteFrameIndex = Math.round(noteFrameIndex + frameOffset) % numNoteFrames;
                var y = targetsY + beatUntilNote * arrowSpacing;
                var alpha = 1;
                if ("tapNoteScore" in noteProps) {
                    if (noteProps.tapNoteScore < 5)
                        alpha = 0;
                }
                noteSprite.draw(canvas, thisNoteFrameIndex, colInfo.x, y, 1, 1, colInfo.rotation, alpha);
            }
        }
    }


    // Sending messages to the iframe
    var frame = document.getElementById('frame');

    function messageFrame(message){
        if(frame){
            frame.contentWindow.postMessage(message, '*');
        }
    }
}