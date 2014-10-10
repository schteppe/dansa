// RequestAnimation shim
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

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

var CANVAS_WIDTH = 320;
var CANVAS_HEIGHT = window.innerHeight;
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
    $("#offset-row").show();
    $("#offset").text(addToMusicPositionSeconds.toFixed(2));
}

var autoSync = false;
function toggleAutosync() {
    autoSync = !autoSync;
    $("#autosync-row").toggle(autoSync);
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

$(document).ready(function () {
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
        }
        if (undefined != col) {
            step(col);
            event.preventDefault();
        }
    });
});





var canvasElement = $("<canvas width='" + CANVAS_WIDTH + "' height='" + CANVAS_HEIGHT + "'></canvas>");
var canvas = canvasElement.get(0).getContext("2d");
canvasElement.prependTo('#sm-micro');

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