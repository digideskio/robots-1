// robot.js -- OMG ROBOTS

var
  sys         = require('sys'),
  assert      = require('assert'),
  fieldobject = require('./fieldobject'),
  vec         = require('./vector'),
  bullet      = require('./bullet'),
  NORTH       = require('./fieldobject').NORTH;

function Robot(name, location, field) {
  this.name = name;
  this.field = field;
  this.location = new vec.Vector(location[0], location[1]);
  this.rotation = vec.normalizeAngle(Math.random() * 2 * Math.PI);
  this.wantedRotation = this.rotation;
  this.bulletCoolDown = 0;

  this.engine = 1;
  this.turretRot = 0;
  this.scanMode = "";
  this.scanWidth = Math.PI / 6;
  this.scanRange = 500;
  this.speed = 0;
  this.throttle = 0;
  this.armor = 100;
  this.radius = 20; // For collision detection -- circular for now
}
sys.inherits(Robot, fieldobject.FieldObject);

// Return enough information for a client to draw us on the screen.
Robot.prototype.renderInfo = function() {
  var result = {
    type: 'robot',
    name: this.name,
    location: [this.location.x, this.location.y],
    rotation: this.rotation,
    turret_rot: this.turretRot,
    speed: this.speed
  };
  if (this.scanMode !== "") {
    result.scan = {
          mode: this.scanMode,
          width: this.scanMode == "walls"? undefined : this.scanWidth,
          range: this.scanRange
        };
  }
  return result;
};

Robot.prototype.toJSON = function() {
  return {
    name: this.name,
    armor: this.armor
  };
};

Robot.prototype.pump = function() {
  // Calculate our physics: turn, move, or whatever.
  // First, we'll turn.
  var angleDiff = vec.normalizeAngle(this.wantedRotation - this.rotation),
      rotAccel = this.engine/5;
  if (Math.abs(angleDiff) < rotAccel) {
    this.rotation = this.wantedRotation;
  } else {
    this.rotation += angleDiff>0? rotAccel : -rotAccel;
  }
  this.rotation = vec.normalizeAngle(this.rotation);

  // Now, do throttle!
  var speedDiff = this.throttle - this.speed,
      accel = this.engine * 3;
  if (Math.abs(speedDiff) < accel) {
    this.speed += speedDiff;
  } else {
    this.speed += speedDiff>0? accel : -accel;
  }

  this.bulletCoolDown++;

  // Now, change our location!
  this.field.move(this,
    new vec.Vector(
      Math.sin(this.rotation),
      Math.cos(this.rotation)
    ).multiply(this.speed));
};

Robot.prototype.collidedWithWall = function() {
  // We collided with a wall? Onoes!
  this.speed /= 2;
  this.throttle /= 2;
  if (Math.abs(this.throttle) < 0.5) {
    this.throttle = 0;
  }
};

Robot.prototype.getRotation = function() {
    return this.rotation;
};

Robot.prototype.turn = function(amount) {
  this.wantedRotation = this.rotation + amount;
  return amount;
};

Robot.prototype.bearingTo = function(location) {
    // Return the direction (in radians) from our nose to the given vector
    // |
    // |
    // |-.  this angle
    // |  \ 
    // us-.:___      -   -   - the angle our vector library expects
    //         ''---..__
    //                  ''--location
    var angle = location.sub(this.location).angleTo(NORTH);
    angle = location.sub(this.location).x>0? angle : -angle;
    return vec.normalizeAngle(
      // Negative because the vector library is counting CCW and we want CW
      angle - this.rotation
    );
};

Robot.prototype.turretBearingTo = function(location) {
    // Return the direction (in radians) from our nose to the given vector
    // |   /turret angle
    // |  /
    // | /. return this angle
    // |/  \
    // us-.:___      -   -   - the angle our vector library expects
    //         ''---..__
    //                  ''--location
    var angle = location.sub(this.location).angleTo(NORTH);
    angle = location.sub(this.location).x>0? angle : -angle;
    return vec.normalizeAngle(
      // Negative because the vector library is counting CCW and we want CW
      angle - (this.rotation + this.turretRot)
    );
};

Robot.prototype.distanceTo = function(location) {
    return this.location.sub(location).dist();
};

Robot.prototype.getTurretRot = function() {
  return this.turretRot;
};

Robot.prototype.setTurretRot = function(newRot) {
  this.turretRot = vec.normalizeAngle(newRot);
  return newRot;
};

Robot.prototype.getLocation = function() {
  return [this.location.x, this.location.y];
};

Robot.prototype.getSpeed = function() {
  return this.speed;
};

Robot.prototype.getThrottle = function() {
  return this.throttle;
};

Robot.prototype.setThrottle = function(throttle) {
  // Set throttle. The minimum we can have is -self.engine*5 and the max we
  // can have is self.engine*10.
  // This expects a number between -50 and 100.
  var amount = Math.max(-50, Math.min(throttle, 100));
  this.throttle = 10 * this.engine * amount/100;
  return this.throttle;
};

Robot.prototype.scanRobots = function(scanWidth) {
    // Scan for robots! Returns a function that, when called, will scan for
    // other robots. Keep this in the "PARTIAL_DELAYED" section of your game
    // logic.
    // Steps:
    //  - Find all objects within scanRange of us
    //  - Of these, only keep robots that aren't ourselves that are within our
    //    scan arc
    //  - Then, return this list to the client, mixing in bearing and distance
    //    information wrt our turret
    assert.ok(scanWidth <= Math.PI/2, "You can only scan 90° to one side.");
    assert.equal(this.scanMode, "", "You are already scanning for something!");
    // Do this stuff right away so the client knows to draw the scan arc
    this.scanMode = "robots";
    this.scanWidth = scanWidth;

    // The gamelogic will call this function later.
    var self = this; // for closure
    return function finishScan() {
      // Tell the client to stop drawing a scan arc
      self.scanMode = "";
      // Find all objects within our radius...
      return self.field.allObjectsWithin(self.location, self.scanRange).filter(
        function filter(obj) {
          // Only keep the robots that aren't ourselves and that are within
          // our scan arc
          return (obj instanceof Robot) &&
                 (obj !== self) &&
                 (Math.abs(self.turretBearingTo(obj.location)) <
                   self.scanWidth);
        }).map(
          function (obj) {
          // Now, take the resulting list of robots and augment them with
          // distance and angle information. Return this list to the client.
          var result = obj.toJSON();
          result.distance = Math.floor(self.distanceTo(obj.location)/20)*20;
          result.bearing = Math.round(
              self.turretBearingTo(obj.location)*2/self.scanWidth)/2;
          return result;

        });
    };
};

Robot.prototype.scanWall = function() {
  // Returns a function that, when called, will scan walls. Another
  // PARTIAL_DELAYED.
  assert.equal(this.scanMode, "", "You are already scanning for something!");
  this.scanMode = "walls";
  var self = this;
  return function finishScan() {
    self.scanMode = "";
    var dist = self.field.distToWall(self.location, self.rotation + self.turretRot);
    return dist < self.scanRange? dist : null;
  };
};

Robot.prototype.fire = function(adjust) {
  // Fire a bullet! KABLOOOIE
  // 'adjust' is a paramater that allows you to adjust the aim of your turret
  // by up to ± pi/15 radians. (Don't warn about exceeding this, just clip it)
  adjust = Math.min(Math.PI/15, Math.max(-Math.PI/15, adjust));
  //require('../log').debug("PEW PEW PEW! robot fired " + adjust);
  if (this.bulletCoolDown < 3) {
    // Don't fire too fast now! But don't throw an error or anything.
    return false;
  }
  this.bulletCoolDown = 0;

  var newBullet = new bullet.Bullet(
      this.field, // Field
      this, // Owner (don't kill us plz!)
      this.location.copy(),
      this.rotation + this.turretRot + adjust
    );
  this.field.addObject(newBullet);
  this.emit("fire", this, newBullet);
  return true;
};

Robot.prototype.isTangible = function(other) {
  return true; // Robots are always tangible
};

Robot.prototype.collidedWith = function(other) {
  // CRASH POSITIONS! Reduce our speed.
  // Rules: If we hit something straight on, then we should reduce our throttle by half.
  // If we hit something to the side, we should keep our throttle because it hit us.
  // If we hit something from behind? Don't touch throttle.
  //
  // Now. Remember that "straight on" means "in the direction of travel," so if
  // we're moving backwards, account for that.
  //
  //   collision
  //    x--.
  //   / \  \
  //   |  O-+---> travel
  //   \    /
  //    '--'
  //     us
  //

  // diff will be a scalar between 0 and 1 that represents how parallel we are.
  //          0    0.7
  //          | ,-'
  //    0 - - > - - 1
  //          | `-.
  //          0    0.7
  if (other.isTangible(this)) {
    var diff = Math.max(0, Math.cos(this.bearingTo(other.location)) * (this.speed>0?1:-1));
    // if other is right on top of us, the delta vector is <0, 0> and we can't
    // get the angle of that vector, so diff will be NaN. Found this out the
    // hard way.
    diff = isNaN(diff)? 1:diff;

    // Reduce the throttle and speed by up to .2 with cutoff
    this.throttle -= this.throttle * 0.2 * diff;
    this.speed -= this.throttle * 0.2 * diff;
    if (Math.abs(this.throttle) < 0.5) {
      this.throttle = 0;
    }
  }
};

Robot.prototype.hullDamage = function(damage) {
  // Gamelogic calls us when bullets hit. (see: gamelogic.robotBulletColission)
  if (this.armor > 0) {
    this.armor -= damage;
    this.emit("damaged", this, damage);
    if (this.armor <= 0) {
      this.emit("died", this);
    }
  }
};

exports.Robot = Robot;
