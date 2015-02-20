  /** @private
   * Destroys the current element
   */
  var destroy = (function () {
    var trash = document.createElement('div');
    return function (element) {
      trash.appendChild(element);
      trash.innerHTML = '';
      trash = null;
    };
  })();

  dom._jsonpCallbacks = {};

  dom.jsonpRequest = (function(){
    var id = 0;

    return function(options) {
      return new AnonymousObservable(function(observer) {

        var callbackId = 'callback_' + (id++).toString(36); 

        var settings = {
          jsonp: 'JSONPCallback',
          async: true,
          jsonpCallback: 'Rx.DOM._jsonpCallbacks.' + callbackId
        };

        if(typeof options === 'string') {
          settings.url = options;
        } else {
          for(var prop in options) {
            if(hasOwnProperty.call(options, prop)) {
              settings[prop] = options[prop];
            }
          }
        }

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = settings.async;
        script.src = settings.url.replace(settings.jsonp, settings.jsonpCallback);

        dom._jsonpCallbacks[callbackId] = function(data) {
          dom._jsonpCallbacks[callbackId].called = true;
          dom._jsonpCallbacks[callbackId].data = data;
        };

        var handler = function(e) {
          if(e.type === 'load' && !dom._jsonpCallbacks[callbackId].called) {
            e = { type: 'error' };
          }
          var status = e.type === 'error' ? 400 : 200;
          var data = dom._jsonpCallbacks[callbackId].data;

          if(status === 200) {
            observer.onNext({
              status: status,
              response: data,
              originalEvent: e
            });

            observer.onCompleted();
          }
          else {
            observer.onError({
              status: status,
              originalEvent: e
            });
          }
        };

        script.addEventListener('load', handler);
        script.addEventListener('error', handler);

        var parent = document.body || document.documentElement;
        parent.appendChild(script);

        return function() {
          //TODO: angular actually sets this to noop instead of deleting, unsure why.
          delete dom._jsonpCallbacks[callbackId];
          script.removeEventListener('load', handler);
          script.removeEventListener('error', handler);
          destroy(script);
        };
      });
    }
  }());
  /**
   * Creates a cold observable JSONP Request with the specified settings.
   *
   * @example
   *   source = Rx.DOM.jsonpRequest('http://www.bing.com/?q=foo&JSONPRequest=?');
   *   source = Rx.DOM.jsonpRequest( url: 'http://bing.com/?q=foo', jsonp: 'JSONPRequest' });
   *
   * @param {Object} settings Can be one of the following:
   *
   *  A string of the URL to make the JSONP call with the JSONPCallback=? in the url.
   *  An object with the following properties
   *   - url: URL of the request
   *   - jsonp: The named callback parameter for the JSONP call
   *   - jsonpCallback: Callback to execute. For when the JSONP callback can't be changed
   *
   * @returns {Observable} A cold observable containing the results from the JSONP call.
   */
  // dom.jsonpRequest = (function () {
  //   var uniqueId = 0;
  //   var defaultCallback = function _defaultCallback(observer, data) {
  //     observer.onNext(data);
  //     observer.onCompleted();
  //   };

  //   return function (settings) {
  //     return new AnonymousObservable(function (observer) {
  //       typeof settings === 'string' && (settings = { url: settings });
  //       !settings.jsonp && (settings.jsonp = 'JSONPCallback');

  //       var head = document.getElementsByTagName('head')[0] || document.documentElement,
  //         tag = document.createElement('script'),
  //         handler = 'rxjscallback' + uniqueId++;

  //       if (typeof settings.jsonpCallback === 'string') {
  //         handler = settings.jsonpCallback;
  //       }

  //       settings.url = settings.url.replace('=' + settings.jsonp, '=' + handler);

  //       var existing = root[handler];
  //       root[handler] = function(data, recursed) {
  //         if (existing) {
  //           existing(data, true) && (existing = null);
  //           return false;
  //         }
  //         defaultCallback(observer, data);
  //         !recursed && (root[handler] = null);
  //         return true;
  //       };

  //       var cleanup = function _cleanup() {
  //         tag.onload = tag.onreadystatechange = null;
  //         head && tag.parentNode && destroy(tag);
  //         tag = undefined;
  //       };

  //       tag.src = settings.url;
  //       tag.async = true;
  //       tag.onload = tag.onreadystatechange = function (_, abort) {
  //         if ( abort || !tag.readyState || /loaded|complete/.test(tag.readyState) ) {
  //           cleanup();
  //         }
  //       };
  //       head.insertBefore(tag, head.firstChild);

  //       return function () {
  //         if (!tag) { return; }
  //         cleanup();
  //       };
  //     });
  //   };
  // })();
