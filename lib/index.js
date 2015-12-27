'use strict';


var _ = require('underscore');
var LRUCache = require('lru-cache');


module.exports = function (options) {

  var seneca = this;

  var settings = seneca.util.deepextend({
    prefix: 'seneca-vcache',
    maxhot: 1111,
    expires: 3600                               // 1 Hour
  }, options);

  // Setup in-memory cache

  var cache = LRUCache(settings.maxhot);

  // Statistics

  var stats = {
    start: Date.now(),
    set: 0,
    get: 0,
    vinc: 0,
    vadd: 0,
    vmiss: 0,
    vhit: 0,
    lru_hit: 0,
    net_hit: 0,
    lru_miss: 0,
    net_miss: 0,
    drop: 0,
    cache_errs: 0
  };

  // Keys

  var versionKey = function (ent, id) {

    // Example: 'seneca-vcache~v~zen/moon/bar~171qa9'

    var key = settings.prefix + '~v~' + ent.canon$({ string: true }) + '~' + id;
    return key;
  };

  var dataKey = function (ent, id, version) {

    // Example: 'seneca-vcache~d~0~zen/moon/bar~171qa9'

    var key = settings.prefix + '~d~' + version + '~' + ent.canon$({ string: true }) + '~' + id;
    return key;
  };

  // Cache write

  var writeKey = function (seneca, vkey, callback) {

    // New item

    var item = {
      key: vkey,
      val: 0,
      expires: settings.expires
    };

    seneca.act({ role: 'cache', cmd: 'add' }, item, function (err, writtenKey) {

      if (err) {
        ++stats.cache_errs;
        return callback(err);
      }

      ++stats.vadd;
      return callback(null);
    });
  };

  var writeData = function (seneca, ent, version, callback) {

    var key = dataKey(ent, ent.id, version);
    seneca.log.debug('set', key);

    cache.set(key, ent);
    seneca.act({ role: 'cache', cmd: 'set' }, { key: key, val: ent.data$(), expires: settings.expires }, function (err, key) {

      if (err) {
        ++stats.cache_errs;
        return callback(err);
      }

      ++stats.set;
      return callback(null, key);
    });
  };

  var save = function (args, callback) {

    var self = this;

    // Pass to lower priority entity action first

    this.prior(args, function (err, ent) {

      if (err) {
        return callback(err);
      }

      // Generate version key

      var vkey = versionKey(ent, ent.id);

      self.act({ role: 'cache', cmd: 'incr' }, { key: vkey, val: 1 }, function (err, version) {

        if (err) {
          ++stats.cache_errs;
          return callback(err);
        }

        if (version === false) {

          // New item

          writeKey(self, vkey, function (err) {

            if (err) {
              return callback(err);
            }

            writeData(self, ent, 0, function (err, out) {

              if (err) {
                return callback(err);
              }

              return callback(null, ent);
            });
          });

          return;
        }

        // Updated item

        ++stats.vinc;
        writeData(self, ent, version, function (err, out) {

          if (err) {
            return callback(err);
          }

          return callback(null, ent);
        });
      });
    });
  };

  // Cache read

  var load = function (args, callback) {

    var self = this;

    var prior = this.prior;
    var qent = args.qent;

    // Verify id format is compatible

    if (!args.q.id || Object.keys(args.q).length !== 1) {
      return prior(args, callback);
    }

    var id = args.q.id;

    // Lookup version key

    var vkey = versionKey(qent, id);
    this.act({ role: 'cache', cmd: 'get' }, { key: vkey }, function (err, version) {

      if (err) {
        ++stats.cache_errs;
        return callback(err);
      }

      ++stats.get;

      // Version not found

      if (version === undefined ||
          version === -1) {                               // Item dropped from cache

        ++stats.vmiss;
        self.log.debug('miss', 'version', vkey);
        self.log.debug('miss', qent, id, 0);

        // Pass to lower priority handler

        return prior(args, function (err, ent) {

          if (err || !ent) {                          // Error or not found
            return callback(err, null);
          }

          writeKey(self, vkey, function (err) {

            if (err) {
              return callback(err);
            }

            return writeData(self, ent, 0, function (err, version) {

              if (err) {
                return callback(err);
              }

              return callback(null, ent);
            });
          });
        });
      }

      // Version found

      ++stats.vhit;
      var key = dataKey(qent, id, version);
      var record = cache.get(key);
      if (record) {

        // Entry found (cache)

        self.log.debug('hit', 'lru', key);
        ++stats.lru_hit;
        return callback(null, qent.make$(record));
      }

      // Entry not found (evicted from cache)

      self.log.debug('miss', 'lru', key);
      ++stats.lru_miss;

      self.act({ role: 'cache', cmd: 'get' }, { key: key }, function (err, ent) {

        if (err) {
          ++stats.cache_errs;
          return callback(err);
        }

        // Entry found (upstream)

        if (ent) {
          ++stats.net_hit;
          cache.set(key, ent);
          self.log.debug('hit', 'net', key);
          return callback(null, qent.make$(ent));
        }

        // Not found (upstream)

        ++stats.net_miss;
        self.log.debug('miss', 'net', key);
        return callback(null, null);
      });
    });
  };

  // Cache remove

  var remove = function (args, callback) {

    var self = this;

    this.prior(args, function (err, ent) {

      if (err) {
        return callback(err);
      }

      var vkey = versionKey(args.qent, args.q.id);    // Only called with a valid entity id
      self.act({ role: 'cache', cmd: 'set' }, { key: vkey, val: -1, expires: settings.expires }, function (err, ent) {

        if (err) {
          ++stats.cache_errs;
          return callback(err);
        }

        ++stats.drop;
        self.log.debug('drop', vkey);
        return callback(null, ent);
      });
    });
  };

  // Cache list

  var list = function (args, callback) {

    // Pass-through to underlying cache

    return this.prior(args, callback);
  };

  // Register cache interface

  var registerHandlers = function (args) {

    seneca.add(_.extend({}, args, { role: 'entity', cmd: 'save' }), save);
    seneca.add(_.extend({}, args, { role: 'entity', cmd: 'load' }), load);
    seneca.add(_.extend({}, args, { role: 'entity', cmd: 'list' }), list);
    seneca.add(_.extend({}, args, { role: 'entity', cmd: 'remove' }), remove);
  };

  if (settings.entities) {
    _.each(settings.entities, function (entspec) {

      registerHandlers(_.isString(entspec) ? seneca.util.parsecanon(entspec) : entspec);
    });
  }
  else {
    registerHandlers();
  }

  // Register cache statistics action

  seneca.add({ plugin: 'vcache', cmd: 'stats' }, function (args, next) {

    var result = _.clone(stats);
    result.hotsize = cache.keys().length;
    result.end = Date.now();
    this.log.debug('stats', result);
    return next(null, result);
  });

  return { name: 'vcache' };
};
