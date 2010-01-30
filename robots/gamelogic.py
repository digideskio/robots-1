#!/usr/bin/env python
# -*- coding: utf-8 -*-

from twisted.internet.defer import Deferred
import robot
import field
import vector
import misc

class later_action(object):
    """
    represents an action that'll be carried out against a robot later.
    """
    def __init__(self, robot, defr, action, kwargs):
        self.robot = robot
        self.defr = defr
        # actually a string name
        self.action = action
        self.kwargs = kwargs


    def __call__(self):
        try:
            # first, find what function we should do
            what_to_do = getattr(self.robot, self.action)
            # carry it out
            result = what_to_do(**kwargs)
            # ... and send it back to the client, or whatever else the
            # deferred does
            self.defr.callback(result)
        except Exception, e:
            # the drgn blow'd up!
            self.defr.errback(e)



###################
class Game(object):
    """
    Represents the logic for this game.
    """
    def __init__(self):
        """
        create a field, history, and robots
        """
        self.time = 0
        # maps time to a list of actions
        # {25: [action, action, action]} means three actions
        # should be executed at time=25
        self.history = {}
        self.field = field.Field()
        # maps unique IDs to robots
        self.robots = {}


    def pump(self):
        """
        Go through the history. Carry out the action on the robot.
        """
        pass

    def queue_action(self, robot_id, action, **kwargs):
        """
        Queue some action to go on the history.
        This returns a Deferred. Attach callbacks if you like; they'll get
        executed once your robot carries out its task.
        Will check to ensure that there aren't any actions from this robot
        already.
        """
        assert robot_id in self.robots and self.robots[robot_id] ("This robot "
        "doesn't exist!")
        pass


    @property
    def finished(self):
        """
        Is the game finished?
        """
        pass



class ATRobotsInspiredGame(Game):
    pass
