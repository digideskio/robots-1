// robot_views.js
// --------------
// This file handles connections with the robot. We're the guys who forward
// various actions to the game logic when you ask your robot to turn or
// whatever.

var
  url          = require('url'),
  assert       = require('assert'),
  switchboard  = require('./switchboard'),
  log          = require('../log'),
  pickCoolName = require('./robot_naming').pickCoolName,
  renderJson   = require('./view_helpers').renderJson,
  renderError  = require('./view_helpers').renderError;

// No ears here.

// A useful function: automatically ask the game to do something. Then, render
// the request and result.
function takeGameAction(match, robotId, action, numargs) {
  return function(req, res) {
    var args = Array.prototype.slice.call(arguments, -numargs);
    assert.ok(match.game.started, "The match isn't started yet!");
    match.game.robotAction(robotId, action, args,
      // callback
      function(result) {
        return renderJson(req, res, result);
      },
      // errback
      function(err) {
        return renderError(req, res, err);
      });
  };
}

function dispatchRobotViews(req, res, robot, robotId, match) {
  // This function handles rendering what happens to the robots.
  var query = url.parse(req.url, true).query || {};
  return switchboard.dispatchQueryOverload(req, res,
    // http://localhost:8080/matches/mid/robot_id?rotate=t
    ['rotate'],
    takeGameAction(match, robotId, 'rotate', 0),

    // http://localhost:8080/matches/mid/robot_id?connect=t
    ['connect'],
    function(req, res) {
      if (match.game.started) {
        // If we've started, don't change the robot. Just tell what the robot
        // is.
        return renderJson(req, res, match.game.robots[robotId]);
      }

      match.game.setFuture(0, robotId,
        // Callback
        function() {
          // What happens when the match starts?
          // Render the robot. BUT don't render just 'var robot'; maybe it
          // changed since then.
          return renderJson(req, res, match.game.robots[robotId]);
        },
        // Errback
        function(err) {
          // This part will get run whenever we get duplicate connections.
          // No need to detect if the robotjis still there or not; this is
          // just an errback.
          match.game.disconnectRobot(robotId);
          return renderError(req, res, err);
        });

      var robot = match.game.makeRobot(robotId, query.name || pickCoolName());

      req.connection.setTimeout(300000); // 5min
      req.connection.addListener("end", function() {
        // Sometimes if the kind fellow on the other end exits his client,
        // he doesn't actually *close* the connection.
        req.connection.close();
      });
      req.connection.addListener("close", function() {
        // Remove the robot, but only if the match didn't start.
        if (!match.game.started && match.game.robots[robotId] === robot) {
          log.warn("Lost connection with match: " + match.mid + " robot: " + robotId);
          match.game.disconnectRobot(robotId);
        }
      });
    }
  );
}

process.mixin(exports,
  { 
    dispatchRobotViews: dispatchRobotViews
  }
);
