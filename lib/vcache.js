/* Copyright (c) 2012-2014 Richard Rodger, MIT License */
"use strict";


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
        drop: 0
    };

    var ef = function (cb) {

        return function (win) {

            return function (err, out, v) {

                err ? cb(err) : win(out, v);
            };
        };
    };

    // Cache write

    function setdata(ent, v, cb) {

        var key = settings.prefix + '~d~' + v + '~' + ent.canon$({ string: true }) + '~' + ent.id
        seneca.log.debug('set', key)

        cache.set(key, ent)
        upstream.set({ key: key, val: ent.data$(), expires: settings.expires }, function (err, out) {
            stats.set++
            cb(err, out)
        })
    }

    var save = function (args, callback) {

        // Pass to lower priority entity action first

        this.prior(args, function (err, out, v) {

            if (err) {
                return callback(err);
            }

            // Generate key

            var ent = out;
            var vkey = settings.prefix + "~v~" + ent.canon$({ string: true }) + '~' + ent.id;

            upstream.incr({ key: vkey, val: 1 }, function (err, out, v) {

                if (err) {
                    return callback(err);
                }

                if (out === null) {

                    // New item

                    upstream.add({ key: vkey, val: 0, expires: settings.expires }, function (err, out, v) {

                        if (err) {
                            return callback(err);
                        }

                        ++stats.vadd;
                        setdata(ent, 0, function (err, out, v) {

                            if (err) {
                                return callback(err);
                            }

                            seneca.log.debug('set', ent, ent.id, out);
                            return callback(null, ent);
                        });
                    });

                    return;
                }

                // Updated item

                ++stats.vinc;
                setdata(ent, out, function (err, out, v) {

                    if (err) {
                        return callback(err);
                    }

                    seneca.log.debug('set', ent, ent.id, out);
                    return callback(null, ent);
                });
            });
        });
    };

    // Cache read

    var criterion = function (q) {          // vcache only works with ent.id

        if (_.isString(q) || _.isNumber(q)) {
            return q;
        }

        if (q.id && 1 == _.keys(q).length) {
            return q.id;
        }

        return null;
    };

    var load = function (args, cb) {

        var prior = this.prior
        var qent = args.qent
        var q = args.q

        var er = ef(cb)
        var id = criterion(q)

        if (null == id) {
            return prior(args, cb)
        }

        function get(qent, id, cb) {

            var er = ef(cb)
            var vkey = settings.prefix + '~v~' + qent.canon$({ string: true }) + '~' + id

            upstream.get({ key: vkey }, er(function (v) {
                stats.get++
                //TODO: @iantocristian when is v false
                if (false === v || _.isUndefined(v) || _.isNull(v)) {
                    stats.vmiss++
                    seneca.log.debug('miss', 'version', vkey)
                    cb(null, null, 0)
                }
                else {
                    stats.vhit++

                    var key = settings.prefix + "~d~" + v + "~" + qent.canon$({ string: true }) + "~" + id

                    var out = cache.get(key)
                    if (out) {
                        seneca.log.debug('hit', 'lru', key)
                        stats.lru_hit++
                        cb(null, out, v)
                    }
                    else {
                        seneca.log.debug('miss', 'lru', key)
                        stats.lru_miss++
                        upstream.get({ key: key }, er(function (ent) {
                            if (ent) {
                                stats.net_hit++
                                cache.set(key, ent)
                                seneca.log.debug('hit', 'net', key)
                            }
                            else {
                                stats.net_miss++
                                seneca.log.debug('miss', 'net', key)
                            }
                            cb(null, ent, v)
                        }))
                    }
                }
            }))
        };

        get(qent, id, er(function (out, v) {
            if (out) {
                var ent = qent.make$(out)
                cb(null, ent)
            }
            else {
                seneca.log.debug('miss', qent, id, v)
                prior(args, er(function (ent) {
                    if (ent) {
                        setdata(ent, v, er(function () {
                            cb(null, ent)
                        }))
                    }
                    else {
                        cb(null, null)
                    }
                }))
            }
        }))
    };

    // Cache remove

    var remove = function (args, cb) {

        var prior = this.prior
        var qent = args.qent
        var q = args.q

        var er = ef(cb)
        prior(args, er(function (ent) {
            var id = criterion(q)
            if (null == id) {
                return cb(null, ent)
            }

            var vkey = settings.prefix + "~v~" + qent.canon$({ string: true }) + '~' + id
            upstream.set({ key: vkey, val: -1, expires: settings.expires }, er(function () {
                stats.drop++
                seneca.log.debug('drop', vkey)
                cb(null, ent)
            }))
        }))
    };

    // Cache list

    var list = function (args, cb) {

        return this.prior(args, cb);        // Pass-through to underlying cache
    };

    // Register cache interface

    var reghandlers = function (args) {

        seneca.add(_.extend({}, args, { role: 'entity', cmd: 'save' }), save);
        seneca.add(_.extend({}, args, { role: 'entity', cmd: 'load' }), load);
        seneca.add(_.extend({}, args, { role: 'entity', cmd: 'list' }), list);
        seneca.add(_.extend({}, args, { role: 'entity', cmd: 'remove' }), remove);
    };

    if (settings.entities) {
        _.each(settings.entities, function (entspec) {
            reghandlers(_.isString(entspec) ? seneca.util.parsecanon(entspec) : entspec);
        })
    }
    else {
        reghandlers();
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


