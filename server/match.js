// One single match
//
var
  sys       = require('sys'),
  events    = require('events'),
  assert    = require('assert'),
  log       = require('./log'),
  gamelogic = require('./gamelogic');

function Match(mid, authCode, pub) {
  this.initTime = Date();
  this.mid = mid;
  this.authCode = authCode;
  this.pub = pub;
  this.game = new gamelogic.GameLogic(this);

  this.speed = 0.5;

  this.timer = null;

  // field_size
  // robots
}
sys.inherits(Match, events.EventEmitter);

Match.prototype.toJson = function() {
  // TODO: the python code actually calls game.__json__() and then adds these
  // properties on top of it.
  return process.mixin(this.game.toJson(),
    {
      init_time: this.initTime,
      speed: this.speed,
      'public': this.pub
    }
  );
};

Match.prototype.start = function() {
  // Start the match.
  // We must remove all the blank robots first.
  for (var rid in this.game.robots) {
    if (this.game.robots.hasOwnProperty(rid) &&
        this.game.robots[rid] === null) {
          this.game.disconnectRobot(rid);
      }
  }
  this.game.start();

  // We must assign something to 'this' because inside the function in
  // setTimeout, 'this' refers to the window object.
  var self = this;
  this.timer = setInterval(function() {
    self.game.pump();
  }, 1000/this.speed);
  this.emit("started", this);
};

Match.prototype.pump = function() {
    this.game.pump();
};

Match.prototype.requestSlot = function(slotId) {
  // set this.game.robots[slot_id] to null and emit an event. Only if we're
  // not started.
  assert.ok(!this.game.started, "You cannot join a started match.");
  if (slotId in this.game.robots) {
    log.warn("Match " + this.mid + " tried to request " + slotId + ", a taken slot");
    return false;
  }
  this.game.robots[slotId] = null;
  this.emit("newSlot", this, slotId);
  return slotId;
};

Match.prototype.removeSlot = function(slotId) {
  // remove this.game.robots[slotId], but ONLEH if we're not started. Emit an
  // event. gamelogic will call us.
  assert.ok(!this.game.started, "You cannot leave a started match.");
  if (!(slotId in this.game.robots)) {
    log.warn("Match " + this.mid + " tried to remove " + slotId + ", a nonexistent slot");
    return false;
  }
  if (this.game.robots[slotId] !== null) {
    this.game.disconnectRobot(slotId);
  }
  delete this.game.robots[slotId];
  this.emit("removeSlot", this, slotId);
};


process.mixin(exports,
  {
    Match: Match
  }
);
