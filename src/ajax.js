
  // Gets the proper XMLHttpRequest for support for older IE
  function getXMLHttpRequest() {
    if (root.XMLHttpRequest) {
      return new root.XMLHttpRequest();
    } else {
      var progId;
      try {
        var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];
        for(var i = 0; i < 3; i++) {
          try {
            progId = progIds[i];
            if (new root.ActiveXObject(progId)) {
              break;
            }
          } catch(e) { }
        }
        return new root.ActiveXObject(progId);
      } catch (e) {
        throw new Error('XMLHttpRequest is not supported by your browser');
      }
    }
  }

  var isWithCredentials = !!('withCredentials' in root.XMLHttpRequest.prototype);
  var isLegacyCORS = !isWithCredentials && !!root.XDomainRequest;
  var isXHR2 = !!(new XMLHttpRequest()).upload;

  // Get CORS support even for older IE
  function getCORSRequest() {
    if (isWithCredentials) {
      return new root.XMLHttpRequest();
    } else if (isLegacyCORS) {
      return new XDomainRequest();
    } else {
      throw new Error('CORS is not supported by your browser');
    }
  }

  function normalizeAjaxLoadEvent(e, xhr, settings) {
    var response = ('response' in xhr) ? xhr.response : 
      (settings.responseType === 'json' ? JSON.parse(xhr.responseText) : xhr.responseText);
    return {
      response: response,
      status: xhr.status,
      responseType: xhr.responseType,
      xhr: xhr,
      originalEvent: e
    };
  }

  function normalizeAjaxErrorEvent(e, xhr, type) {
    return {
      type: type,
      status: xhr.status,
      xhr: xhr,
      originalEvent: e
    };
  }

  /**
   * Creates an observable for an Ajax request with either a options object with url, headers, etc or a string for a URL.
   *
   * @example
   *   source = Rx.DOM.ajax('/products');
   *   source = Rx.DOM.ajax( url: 'products', method: 'GET' });
   *
   * @param {Object} options Can be one of the following:
   *
   *  A string of the URL to make the Ajax call.
   *  An object with the following properties
   *   - url: URL of the request
   *   - body: The body of the request
   *   - method: Method of the request, such as GET, POST, PUT, PATCH, DELETE
   *   - async: Whether the request is async
   *   - headers: Optional headers
   *   - crossDomain: true if a cross domain request, else false
   *
   * @returns {Observable} An observable sequence containing the XMLHttpRequest.
  */
  var ajaxRequest = dom.ajax = function (options) {
    var settings = {
      method: 'GET',
      crossDomain: false,
      async: true
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

    return new AnonymousObservable(function (observer) {
      var isDone = false;

      var xhr;
      try {
        xhr = settings.crossDomain ? getCORSRequest() : getXMLHttpRequest();
      } catch (err) {
        observer.onError(err);
      }

      try {
        if (settings.user) {
          xhr.open(settings.method, settings.url, settings.async, settings.user, settings.password);
        } else {
          xhr.open(settings.method, settings.url, settings.async);
        }

        if (settings.headers) {
          var headers = settings.headers;
          for (var header in headers) {
            if (hasOwnProperty.call(headers, header)) {
              xhr.setRequestHeader(header, headers[header]);
            }
          }
        }

        if(isXHR2 || isLegacyCORS) {
          xhr.onload = function(e) {
            observer.onNext(normalizeAjaxLoadEvent(e, xhr));
            observer.onCompleted();
          };

          if(settings.progressObserver) {
            xhr.onprogress = function(e) {
              settings.progressObserver.onNext(e);
            };
          }

          xhr.onerror = function(e) {
            observer.onError(normalizeAjaxErrorEvent(e, xhr, 'error'));
          };

          xhr.onabort = function(e) {
            observer.onError(normalizeAjaxErrorEvent(e, xhr, 'abort'));
          };
        } else {
          xhr.onreadystatechange = function(e) {
            if(xhr.readyState === 4) {
              var status = xhr.status;
              if ((status >= 200 && status <= 300) || status === 0 || status === '') {
                observer.onNext(normalizeAjaxLoadEvent(e, xhr));
                observer.onCompleted();
                isDone = true;
              } else {
                observer.onError(normalizeAjaxErrorEvent(e, xhr, 'error'));
              }
            }
          };
        }

        if(settings.responseType) {
          try {
            xhr.responseType = settings.responseType;
          } catch(e) {
            // json payloads are always parsed by the client
            if(xhr.responseType !== 'json') {
              throw e;
            }
          }
        }

        if(isXHR2 && settings.uploadObserver) {
          xhr.upload.onprogress = function(e) {
            settings.uploadProgressObserver.onNext(e);
          };

          xhr.upload.onerror = function(e) {
            settings.uploadObserver.onError(e);
          };

          xhr.upload.onload = function(e) {
            settings.uploadObserver.onNext(e);
            settings.uploadObserver.onCompleted();
            isDone = true;
          };

          xhr.upload.onabort = function(e) {
            settings.uploadObserver.onError(e);
          };
        }

        var body = settings.body;

        // if sending an object, and content type is application/json,
        // serialize it for the user.
        if(settings.headers && settings.headers['content-type'] === 'application/json' &&
            typeof body === 'object') {
          body = JSON.stringify(body);
        }

        xhr.send(body);
      } catch (e) {
        observer.onError(e);
      }

      return function () {
        if (!isDone && xhr.readyState !== 4) { 
          xhr.abort(); 
        }
      };
    });
  };

  /**
   * Creates an observable sequence from an Ajax POST Request with the body.
   *
   * @param {String} url The URL to POST
   * @param {Object} body The body to POST
   * @returns {Observable} The observable sequence which contains the response from the Ajax POST.
   */
  dom.post = function (url, body) {
    return ajaxRequest({ url: url, body: body, method: 'POST', async: true });
  };

  /**
   * Creates an observable sequence from an Ajax GET Request with the body.
   *
   * @param {String} url The URL to GET
   * @returns {Observable} The observable sequence which contains the response from the Ajax GET.
   */
  var observableGet = dom.get = function (url) {
    return ajaxRequest({ url: url, method: 'GET', async: true });
  };

  /**
   * Creates an observable sequence from JSON from an Ajax request
   *
   * @param {String} url The URL to GET
   * @returns {Observable} The observable sequence which contains the parsed JSON.
   */
  dom.getJSON = function (url) {
    if (!root.JSON && typeof root.JSON.parse !== 'function') { throw new TypeError('JSON is not supported in your runtime.'); }
    return observableGet(url).map(function (xhr) {
      return JSON.parse(xhr.responseText);
    });
  };
