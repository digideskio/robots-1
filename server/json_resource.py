#!/usr/bin/env python
# -*- coding: utf-8 -*-

from twisted.web import resource, server
import json

class JsonObjectEncoder(json.JSONEncoder):
    """
    Serialize using object.__json__ if it has one.
    """
    def default(self, obj):
        if hasattr(obj, '__json__') and callable(getattr(obj, '__json__')):
            return obj.__json__()
        raise TypeError, '%s is not JSON serializable' % obj


class JsonResource(resource.Resource):
    """
    Renders something as a JSON object.
    """
    def __init__(self, obj):
        resource.Resource.__init__(self)
        self.obj = obj
        self.j = JsonObjectEncoder()

    def render_GET(self, request):
        request.write(self.j.encode(self.obj))
        request.finish()
        return server.NOT_DONE_YET
        # ^ seems deceptive, but is the correct way of handling this case.
        # Later versions of twisted will likely return a deferred instead.
        # render() is supposed to either return a string or NOT_DONE_YET
        # immediately, twisted doesn't know that we'll save the request object
        # and directly write to it later even though it's completely supported


class ErrorResource(resource.Resource):
    def __init__(self, errmessage):
        resource.Resource.__init__(self)
        self.err_message = errmessage

    def render_GET(self, request):
        JsonResource({'client_error': self.err_message}).render(request)
        return server.NOT_DONE_YET