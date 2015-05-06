'use strict';


var _ = require('underscore');
var LRUCache = require('lru-cache');


module.exports = function (options) {

  var seneca = this;

  var settings = seneca.util.deepextend({
    prefix: 'seneca-vcache',
    maxhot: 1111,
    expires: 3600
  }, options);

  // Setup in-memory cache

  var cache = LRUCache(settings.maxhot);

  // Upstream cache interface

  var upstream = seneca.pin({ role: 'cache', cmd: '*' });

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
    write_errs: 0
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

  var writeKey = function (vkey, callback) {

    // New item

    var item = {
      key: vkey,
      val: 0,
      expires: settings.expires
    };

    upstream.add(item, function (err, writtenKey) {

      if (err) {
        return callback(err);
      }

      ++stats.vadd;
      return callback(null);
    });
  };

  var writeData = function (ent, version, callback) {

    var key = dataKey(ent, ent.id, version);
    seneca.log.debug('set', key);

    cache.set(key, ent);
    upstream.set({ key: key, val: ent.data$(), expires: settings.expires }, function (err, key) {

      if (err) {
        ++stats.write_errs;
        return callback(err);
      }

      ++stats.set;
      return callback(null, key);
    });
  };

  var save = function (args, callback) {

    // Pass to lower priority entity action first

    this.prior(args, function (err, out) {

      if (err) {
        return callback(err);
      }

      // Generate version key

      var ent = out;
      var vkey = versionKey(ent, ent.id);

      upstream.incr({ key: vkey, val: 1 }, function (err, version) {

        if (err) {
          return callback(err);
        }

        if (version === false) {

          // New item

          writeKey(vkey, function (err) {

            if (err) {
              return callback(err);
            }

            writeData(ent, 0, function (err, out) {

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
        writeData(ent, version, function (err, out) {

          if (err) {
            return callback(err);
          }

          return callback(null, ent);
        });
      });
    });
  };

  // Cache read

  var verifyId = function (q) {                       // Cache only works with ent.id

    if (_.isString(q) || _.isNumber(q)) {
      return q;
    }

    if (q.id && Object.keys(q).length === 1) {
      return q.id;
    }

    return null;
  };

  var load = function (args, callback) {

    var prior = this.prior;
    var qent = args.qent;

    // Verify id format is compatible

    var id = verifyId(args.q);
    if (id === null) {
      return prior(args, callback);
    }

    // Lookup version key

    var vkey = versionKey(qent, id);
    upstream.get({ key: vkey }, function (err, version) {

      if (err) {
        return callback(err);
      }

      ++stats.get;

      // Version not found

      if (version === undefined ||
          version === -1) {                               // Item dropped from cache

        ++stats.vmiss;
        seneca.log.debug('miss', 'version', vkey);
        seneca.log.debug('miss', qent, id, 0);

        // Pass to lower priority handler

        return prior(args, function (err, out) {

          if (err || !out) {                          // Error or not found
            return callback(err, null);
          }

          writeKey(vkey, function (err) {

            if (err) {
              return callback(err);
            }

            return writeData(out, 0, function (err, version) {

              if (err) {
                return callback(err);
              }

              return callback(null, out);
            });
          });
        });
      }

      // Version found

      ++stats.vhit;
      var key = dataKey(qent, id, version);
      var out = cache.get(key);
      if (out) {

        // Entry found (cache)

        seneca.log.debug('hit', 'lru', key);
        ++stats.lru_hit;
        return callback(null, qent.make$(out));
      }

      // Entry not found (evicted from cache)

      seneca.log.debug('miss', 'lru', key);
      ++stats.lru_miss;

      upstream.get({ key: key }, function (err, out) {

        if (err) {
          return callback(err);
        }

        // Entry found (upstream)

        if (out) {
          ++stats.net_hit;
          cache.set(key, out);
          seneca.log.debug('hit', 'net', key);
          return callback(null, qent.make$(out));
        }

        // Not found (upstream)

        ++stats.net_miss;
        seneca.log.debug('miss', 'net', key);
        return callback(null, null);
      });
    });
  };

  // Cache remove

  var remove = function (args, callback) {

    this.prior(args, function (err, out, v) {

      if (err) {
        return callback(err);
      }

      var ent = out;
      var id = verifyId(args.q);
      if (id === null) {
        return callback(null, ent);
      }

      var vkey = versionKey(args.qent, id);
      upstream.set({ key: vkey, val: -1, expires: settings.expires }, function (err, out) {

        if (err) {
          return callback(err);
        }

        ++stats.drop;
        seneca.log.debug('drop', vkey);
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

    var out = _.clone(stats);
    out.hotsize = cache.keys().length;
    out.end = Date.now();
    seneca.log.debug('stats', out);
    return next(null, out);
  });

  return { name: 'vcache' };
};
