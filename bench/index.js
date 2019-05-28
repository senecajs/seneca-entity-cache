// Load modules

var Assert = require('assert');

var Crypto = require('crypto');
var Hoek = require('hoek');
var Items = require('items');
var Seneca = require('seneca');


// Declare internals

var internals = {
  type: Crypto.randomBytes(8).toString('hex') + Date.now(),
  seneca: Seneca({ log: 'silent' }),
  stored: []
};


internals.seneca.use('memcached-cache');

internals.seneca.use('mongo-store', { name: 'test', host: '127.0.0.1', port: 27017 });
internals.seneca.use('..');


internals.scripts = {
  baseline: [
    { action: 'save', args: [1], repeat: 500 },
    { action: 'load', args: [0, 100], repeat: 50 },
    { action: 'load', args: [300, 400], repeat: 50 },
    { action: 'update', args: [0, 100], repeat: 50 },
    { action: 'load', args: [0, 100], repeat: 50 },
    { action: 'load', args: [300, 400], repeat: 50 }
  ],
  load: [
    { action: 'save', args: [1], repeat: 100 },
    { action: 'load', args: [0, 100], repeat: 1000 },
    { action: 'load', args: [50, 60], repeat: 1000 }
  ]
}

internals.seneca.ready(function () {

  internals.script(internals.scripts.load, function (err) {
    Assert(null == err)
    
    internals.seneca.act({ plugin: 'vcache', cmd: 'stats' }, function (err, stats) {
      Assert(null != stats)
      process.exit();
    });
  });
});


internals.script = function (steps, callback) {

  var prepared = [];
  for (var i = 0, il = steps.length; i < il; ++i) {
    var step = steps[i];
    step.id = i;
    for (var r = 0; r < (step.repeat || 1) ; ++r) {
      prepared.push(step);
    }
  }

  var stats = {};
  var each = function (step, next) {

    return internals.time(step.action, step.args, function (err, result, elapsed) {

      var stat = stats[step.id] || { count: 0, total: 0, avg: 0 };
      ++stat.count;
      stat.total += elapsed;
      stat.avg = stat.total / stat.count;
      stats[step.id] = stat;

      return next(err);
    });
  };

  Items.serial(prepared, each, function (err) {

    for (var i = 0, il = steps.length; i < il; ++i) {
      var step = steps[i];
      console.log(step.action + ',' + step.args.join('-') + ',' + stats[i].avg);
    }

    return callback(err);
  });
};


internals.time = function (method, args, callback) {

  var params = [];
  for (var i = 0, il = args.length; i < il; ++i) {
    params.push(args[i]);
  }

  var bench = new Hoek.Bench();
  params.push(function (err, result) {

    var elapsed = bench.elapsed();
    return callback(err, result, elapsed);
  });

  internals[method].apply(null, params);
};


internals.item = function (value) {

  var base = {
    a: Crypto.randomBytes(8).toString('hex'),
    b: Date.now(),
    c: new Buffer(1024),
    d: value
  };

  return internals.seneca.make(internals.type, base);
};


internals.save = function (value, callback) {

  internals.item(value).save$(function (err, saved) {

    if (err) {
      return callback(err);
    }

    internals.stored.push(saved);
    return callback();
  });
};


internals.load = function (from, to, callback) {

  var item = internals.stored[internals.random(from, to)];
  internals.seneca.make(internals.type).load$(item.id, callback);
};


internals.update = function (from, to, callback) {

  var item = internals.stored[internals.random(from, to)];
  item.b = Date.now();
  item.save$(item.id, callback);
};


internals.random = function (from, to) {

  return Math.floor(Crypto.randomBytes(4).readUInt32BE(0) / 4294967296 * (to - from)) + from;
};
