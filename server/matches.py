#!/usr/bin/env python
# -*- coding: utf-8 -*-

from twisted.web import server, resource
from json_resource import JsonResource, ErrorResource
from twisted.internet import task, reactor
import utils
from robosocket import RoboSocket

class Match(resource.Resource):
    """
    A robot match! Muahaha!

    Has:
        - methods to start and stop
        - a "game" complete with rules
        - a hash of robots

    When a robot requests a slot, it'll 
    """
    def __init__(self, speed=5.0, private=False, start_timeout=10,
            lockstep=False):
        """
        Private: whether the match will show up on public listings (still will
            always grant a slot if someone knows the s33krit match URL)
        Speed: how long to wait for slow robot clients to do something before
            skipping their turn
        Start_timeout: how long do we wait until we start the match
        lockstep: If set, this match will not skip a turn even if all the
            clients are ready to move. If unset (default), the match will
            continue to the next turn if all clients are waiting for something.
        """
        resource.Resource.__init__(self)
        self.http_requests_waiting = []
        self.timer = task.LoopingCall(self.pump)
        self.sockets = {} # bind people to robots. Or not.
        self.speed = speed
        self.private = private
        self.lockstep = lockstep
        if start_timeout:
            self.start_timer = reactor.callLater(start_timeout, self.start)


    def start(self):
        # Start the match, but don't do a tick right away.
        self.timer.start(self.speed, now=False)


    def pause(self):
        self.timer.stop(self.speed)


    def pump(self):
        """
        Pump the game. Then, loop through all outstanding http requests.
        (Actually, the Game should do this; but it's fine for just a test.
        """
        print "pump'd"
        print self.http_requests_waiting
        for request in self.http_requests_waiting:
            JsonResource({'state': 'success'}).render(request)
        self.http_requests_waiting = []


    def connection_lost(self, reason, request):
        """
        called when we lose the connection to a client
        """
        print "Connection lost"
        self.http_requests_waiting.remove(request)


    def render_GET(self, request):
        self.http_requests_waiting.append(request)
        # vv this is a 'deferred'
        defr = request.notifyFinish()
        defr.addErrback(self.connection_lost, request)
        return server.NOT_DONE_YET



class Matches(resource.Resource):
    """
    Represents a list of matches going on in this server.

    You can browse the matches by heading to http://server_url/matches and can
    register your own by going to http://server_url/matches/register.
    """
    MIN_MATCH_SPEED = 0.5               # fastest match allowed


    def __init__(self):
        resource.Resource.__init__(self)
        self.matches = {}


    def render_GET(self, request):
        """
        Returns the public matches
        """
        return JsonResource(self.matches).render(request)


    def register_new(self, **kwargs):
        """
        Registers a new match.
        """
        n = utils.random_string()
        self.matches[n] = Match(**kwargs)
        print "New match registered: %s" % n
        return n


    def getChild(self, path, request):
        """
        Either:
            - Registers and starts a new match
            - Gets a match if there was one
            - Gets the current matches
        """
        if path.lower() == "register":
            # Client wants a new match? Try to make one!
            args = {}
            if 'private' in request.args:
                args['private'] = True
            if 'speed' in request.args:
                if float(request.args['speed'][0]) < self.__class__.MIN_MATCH_SPEED:
                    return ErrorResource("Match can't be that fast")
                else:
                    args['speed'] = float(request.args['speed'][0])
            if 'start_timeout' in request.args:
                args['start_timeout'] = float(request.args['start_timeout'][0])
            if 'lockstep' in request.args:
                args['lockstep'] = True
            # success!
            return JsonResource(self.register_new(**args))

        elif path in self.matches:
            # Client wants a specific match
            return self.matches[path]

        else:
            return ErrorResource('This match does not exist!')

