/* Ember Resourceful v0.0.4 */

(function() {

var slice = Array.prototype.slice;

window.Resourceful = {};

Resourceful.Resource = Ember.Object.extend({
  resourceAdapter: null,
  resourceProperties: null,
  resourceUrl: null,
  serializers: null,
  deserializers: null,

  isFetching: false,
  isFetched: false,
  isSaving: false,
  isDeleting: false,
  isDeleted: false,


  init: function() {
    var _this = this;

    this.persistedProperties = {};
    this.dirtyProperties = [];

    this._super();

    if (this.resourceProperties) {
      this.resourceProperties.forEach(function(key) {
        _this.addObserver(key, function() {
          if (_this.get(key) !== _this.persistedProperties[key]) {
            if (!_this.dirtyProperties.contains(key)) {
              _this.dirtyProperties.pushObject(key);
            }
          } else {
            _this.dirtyProperties.removeObject(key);
          }
        });
      });
    }
  },

  isNew: Ember.computed.equal('id', undefined),

  isDirty: Ember.computed.bool('dirtyProperties.length'),

  serialize: function() {
    var serialized, _this = this;

    serialized = {};

    this.resourceProperties.forEach(function(key) {
      var _ref;
      if ((_ref = _this.serializers) != null ? _ref[key] : void 0) {
        serialized[key] = _this.serializers[key].call(this, _this.get(key));
      } else {
        serialized[key] = _this.get(key);
      }
    });

    if (this.resourceName) {
      var s = {}; s[this.resourceName] = serialized;
      return s;
    } else {
      return serialized;
    }
  },

  deserialize: function(json) {
    var key, value, _ref;

    Ember.beginPropertyChanges(this);

    for (key in json) {
      value = json[key];

      if ((_ref = this.deserializers) != null ? _ref[key] : void 0) {
        value = this.deserializers[key].call(this, value);
      }

      this.set(key, value);
    }

    this.set('isFetched', true);

    Ember.endPropertyChanges(this);

    this._updatePersistedProperties();

    return this;
  },

  fetchResource: function(options) {
    var _this = this;

    this.set('isFetching', true);

    if (!options) {
      options = {};
    }

    if (!options.url) {
      options.url = this._resourceUrl();
    }

    return this.resourceAdapter.request('read', options)
      .done(function(data, textStatus, jqXHR) {
        _this.deserialize(data);
        _this._updatePersistedProperties();
      })
      .always(function() {
        _this.set('isFetching', false);
      });
  },

  saveResource: function(options) {
    var success, method, _this = this;

    this.set('isSaving', true);

    if (!options) {
      options = {};
    }

    if (!options.url) {
      options.url = this._resourceUrl();
    }

    if (!options.data) {
      options.data = this.serialize();
    }

    method = this.get('isNew') ? 'create' : 'update';

    return this.resourceAdapter.request(method, options)
      .done(function(data, textStatus, jqXHR) {
        _this.deserialize(data);
        _this._updatePersistedProperties();

        _this.set('isSaving', false);
      });
  },

  deleteResource: function(options) {
    var _this = this;

    this.set('isDeleting', true);

    if (!options) {
      options = {};
    }

    if (!options.url) {
      options.url = this._resourceUrl();
    }

    return this.resourceAdapter.request('delete', options)
      .done(function() {
        _this.set('isDeleted', true);
      })
      .always(function() {
        _this.set('isDeleting', false);
      });
  },

  revert: function(key) {
    this.set(key, this.persistedProperties[key]);
    this.dirtyProperties.removeObject(key);
  },

  revertAll: function() {
    var _this = this;

    Ember.beginPropertyChanges(this);

    this.dirtyProperties.forEach(function(key) {
      _this.set(key, _this.persistedProperties[key]);
    });

    this.dirtyProperties.clear();

    Ember.endPropertyChanges(this);
  },

  _updatePersistedProperties: function() {
    if (Array.isArray(this.resourceProperties)) {
      var persisted, _this = this;

      persisted = {};

      this.resourceProperties.forEach(function(key) {
        persisted[key] = _this.get(key);
      });

      this.set('persistedProperties', persisted);

      this.dirtyProperties.clear();
    }
  },

  _resourceUrl: function() {
    var url = this.resourceAdapter.namespace + this.constructor.resourceUrl;

    if (!this.get('isNew')) {
      url += '/' + this.get('id');
    }

    return url;
  }
});

Resourceful.Resource.reopenClass({
  find: function(id) {
    if (this.resourceCollectionPath) {
      return Ember.get(this.resourceCollectionPath).findById(id);
    } else {
      throw new Error('You cannot use `find()` without specifying a `resourceCollectionPath` on the Resource\'s prototype!');
    }
  },

  all: function() {
    var collection;

    if (this.resourceCollectionPath) {
      collection = Ember.get(this.resourceCollectionPath);

      if (!collection.get('isFetched')) {
        collection.fetchAll();
      }

      return collection.get('content');
    } else {
      throw new Error('You cannot use `all()` without specifying a `resourceCollectionPath` on the Resource\'s prototype!');
    }
  }
});

Resourceful.ResourceCollection = Ember.ArrayProxy.extend({
  resourceClass: null,
  resourceAdapter: null,

  isFetching: false,
  isFetched: false,

  init: function() {
    var _this = this;

    if (!this.get('content')) {
      this.set('content', Ember.A());
    }

    this._super();

    this._resourceIndex = {};

    this.addArrayObserver(Ember.Object.create({
      arrayWillChange: function(observedObj, start, removeCount, addCount) {
        var removed;

        if (removeCount > 0) {
          observedObj.slice(start, start + removeCount).forEach(function(resource) {
            if (_this._resourceIndex[resource.id]) {
              delete _this._resourceIndex[resource.id];
            }
          });
        }
      },
      arrayDidChange: function(observedObj, start, removeCount, addCount) {
        var added, filtered;

        if (addCount > 0) {
          observedObj.slice(start, start + addCount).forEach(function(resource) {
            _this._resourceIndex[resource.id] = resource;
          });
        }
      }
    }));
  },

  findById: function(id) {
    var resource;

    resource = this._resourceIndex[id];

    if (!resource) {
      resource = this.resourceClass.create({ id: id });

      resource.fetchResource();

      this.pushObject(resource);
    }

    return resource;
  },

  fetch: function(id, options) {
    var resource, _this = this;

    if (!options) {
      options = {};
    }

    resource = this.resourceClass.create({ id: id });

    return resource.fetchResource(options)
      .done(function() {
        _this.pushObject(resource);
      });
  },

  fetchAll: function(options) {
    var success, _this = this;

    this.set('isFetching', true);

    if (!options) {
      options = {};
    }

    if (!options.url) {
      options.url = this._resourceUrl();
    }

    return this.resourceAdapter.request('read', options)
      .done(function(data, textStatus, jqXHR) {
        _this.loadAll(data);
        _this.set('isFetching', false);
        _this.set('isFetched', true);
      });
  },

  loadAll: function(json) {
    var _this = this;

    json.forEach(function(j) {
      _this.load(j);
    });
  },

  load: function(json) {
    var resource;

    resource = this._resourceIndex[json.id];

    if (!resource) {
      resource = this.resourceClass.create();
    }

    resource.deserialize(json);

    if (!this.contains(resource)) {
      this.pushObject(resource);
    }
  },

  _resourceUrl: function() {
    return this.resourceAdapter.namespace + this.resourceClass.resourceUrl;
  }
});

Resourceful.ResourceAdapter = Ember.Object.extend({
  namespace: '',

  request: function(method, options) {
    var crud, deferred, jqXHR, _this = this;

    crud = {
      'create': 'POST',
      'update': 'PUT',
      'read': 'GET',
      'delete': 'DELETE'
    };

    deferred = $.Deferred();

    if (!options) {
      options = {};
    }

    options.success = function(data, textStatus, jqXHR) {
      deferred.resolve(_this.prepareResponse(data), textStatus, jqXHR);
    };

    options.error = function(jqXHR, textStatus, errorThrown) {
      deferred.reject(jqXHR, textStatus, errorThrown);
    };

    options = this.prepareRequest(jQuery.extend({
      dataType: 'json',
      type: crud[method]
    }, options));

    jqXHR = $.ajax(options);

    ['abort'].forEach(function(method) {
      deferred[method] = jqXHR[method];
    });

    return deferred;
  },

  buildURI: function(parts) {
    if (arguments.length > 1) {
      parts = slice.call(arguments, 0)
    } else if (typeof parts === 'string') {
      parts = [parts];
    }

    return encodeURI((this.namespace + '/' + parts.join('/')).replace(/\/+/g, '/'));
  },

  prepareRequest: function(options) {
    return options;
  },

  prepareResponse: function(json) {
    return json;
  }
});

}).call(this);