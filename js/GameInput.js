/**
 * Loads/saves keymaps, keeps track of gamepad state.
 */
function GameInput(){
	var that = this;
	EventEmitter.call(this);

	this.haveEvents = 'GamepadEvent' in window;
	if (this.haveEvents) {
		window.addEventListener("gamepadconnected", connecthandler);
		window.addEventListener("gamepaddisconnected", disconnecthandler);
	}
	function connecthandler(e) {
		that.addGamepad(e.gamepad);
	}
	function disconnecthandler(e) {
		that.removeGamepad(e.gamepad);
	}

	// index : controller
	this.controllers = {};

	// index : object
	this.keymaps = {};

	this.players = [];
	this.addPlayer(); // Add player one - default
	this.scanGamepads();

	this.isSetUp = false;
	this.loadKeymaps();
}

GameInput.prototype = new EventEmitter();

GameInput.prototype.addPlayer = function(){
	this.players.push({
		buttonState: 0
	});
	return this.players.length - 1;
};

/**
 * Should be called in the animation loop.
 */
GameInput.prototype.update = function(){

	this.scanGamepads();

	for(var idx in this.controllers){
		var controller = this.controllers[idx];

		// Check buttons
		for (var i = 0; i<controller.buttons.length; i++) {
			var val = controller.buttons[i];
			var pressed = val == 1.0;

			if (typeof(val) == "object") {
				pressed = val.pressed;
				val = val.value;
			}

			if (pressed) {
				// Map to player and game button
				for(var playerIndex in this.keymaps){
					var map = this.keymaps[playerIndex];

					if(map[i]){
						var p = this.players[playerIndex];
						if(pressed){
							p.buttonState = p.buttonState | map[i];
						} else {
							p.buttonState = (~p.buttonState) & map[i];
						}
					}
				}
			}
		}
	}

	if(this.mappingKey > 0){
		this.endMap();
	}
};

GameInput.prototype.addGamepad = function(gamepad){
	this.controllers[gamepad.index] = gamepad;
};

GameInput.prototype.removeGamepad = function(gamepad){
	delete this.controllers[gamepad.index];
};

GameInput.prototype.scanGamepads = function(gamepad){
	var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
	for (var i = 0; i < gamepads.length; i++) {
		if (gamepads[i]) {
			if (!(gamepads[i].index in this.controllers)) {
				this.addGamepad(gamepads[i]);
			} else {
				this.controllers[gamepads[i].index] = gamepads[i];
			}
		}
	}
};

/**
 * Loads keymaps from localStorage
 */
GameInput.prototype.loadKeymaps = function(){
	if(localStorage.keymaps){
		try {
			this.keymaps = JSON.parse(localStorage.keymaps);
			this.isSetUp = true;
		} catch (err) {
			this.keymaps = {};
			this.isSetUp = false;
		}
	}
};

GameInput.prototype.saveKeymaps = function(){
	localStorage.keymaps = JSON.stringify(this.keymaps);
};

/**
 * Maps the next button press to a key
 * @param  {int} player
 * @param  {int} key
 */
GameInput.prototype.startMap = function(player, key){
	this.mappingPlayer = player;
	this.mappingKey = key;

	// Save current state
	this.mappingState = JSON.parse(JSON.stringify(this.controllers));
};

GameInput.prototype.endMap = function(){
	if(this.mappingPlayer < 0){
		return;
	}

	// Get player keymap
	var keymap = this.keymaps[this.mappingPlayer];
	if(!keymap){
		this.keymaps[this.mappingPlayer] = {};
	}

	// Get diff
	var found = false;
	for(var idx in this.controllers){
		if(found) break;
		var controller = this.controllers[idx];

		for (var i = 0; i < controller.buttons.length; i++) {
			var val = controller.buttons[i];
			var pressed = val == 1.0;

			if (typeof(val) == "object") {
				pressed = val.pressed;
				val = val.value;
			}

			var prevController = this.mappingState[idx];
			if(!prevController){
				continue;
			}

			var val2 = prevController.buttons[i];
			var pressed2 = val2 == 1.0;

			if (typeof(val2) == "object") {
				pressed2 = val2.pressed;
				val2 = val2.value;
			}

			if(!pressed2 && pressed){

				// Store
				keymap[this.mappingKey] = keymap[this.mappingKey] || {};
				var map = keymap[this.mappingKey];
				map.controllerIndex = idx;
				map.button = i;

				found = true;
				break;
			}
		}
	}

	if(found){
		this.mappingPlayer = -1;
		this.mappingKey = -1;
		this.mappingState = null;
		this.emit({ type: 'mapped' });
	}
};

GameInput.Keys = {
	LEFT: 1,
	RIGHT: 2,
	UP: 4,
	DOWN: 8,
	START: 16,
	BACK: 32
};