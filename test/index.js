// Load modules

var Crypto = require('crypto');
var Code = require('code');
var Lab = require('lab');
var Seneca = require('seneca');
var Vcache = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


it('writes then reads a record', function (done) {

  var seneca = Seneca({ log: 'silent' });
  seneca.use('memcached-cache');
  seneca.use('..');

  internals.ready(seneca, function () {

    var type = internals.type();
    var entry = seneca.make(type, { a: 1 });

    // Save

    entry.save$(function (err, saved) {

      expect(err).to.not.exist();
      expect(saved.a).to.equal(entry.a);

      seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

        expect(stats).to.contain({
          set: 1,
          get: 0,
          vinc: 0,
          vadd: 1,
          vmiss: 0,
          vhit: 0,
          lru_hit: 0,
          net_hit: 0,
          lru_miss: 0,
          net_miss: 0,
          drop: 0,
          write_errs: 0,
          hotsize: 1
        });

        // Load

        seneca.make(type).load$(saved.id, function (err, loaded) {

          expect(err).to.not.exist();
          expect(loaded.a).to.equal(entry.a);
          expect(loaded.id).to.equal(saved.id);

          seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

            expect(stats).to.contain({
              set: 1,
              get: 1,
              vinc: 0,
              vadd: 1,
              vmiss: 0,
              vhit: 1,
              lru_hit: 1,
              net_hit: 0,
              lru_miss: 0,
              net_miss: 0,
              drop: 0,
              write_errs: 0,
              hotsize: 1
            });

            // Remove

            loaded.remove$(function (err, out) {

              expect(err).to.not.exist();
              seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

                expect(stats).to.contain({
                  set: 1,
                  get: 1,
                  vinc: 0,
                  vadd: 1,
                  vmiss: 0,
                  vhit: 1,
                  lru_hit: 1,
                  net_hit: 0,
                  lru_miss: 0,
                  net_miss: 0,
                  drop: 1,
                  write_errs: 0,
                  hotsize: 1
                });

                done();
              });
            });
          });
        });
      });
    });
  });
});

it('updates a record', function (done) {

  var seneca = Seneca({ log: 'silent' });
  seneca.use('memcached-cache');
  seneca.use('..');

  internals.ready(seneca, function () {

    var type = internals.type();
    var entry = seneca.make(type, { a: 1 });

    // Save

    entry.save$(function (err, saved) {

      var id = saved.id;
      saved.b = 5;

      seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

        expect(stats).to.contain({
          set: 1,
          get: 0,
          vinc: 0,
          vadd: 1,
          vmiss: 0,
          vhit: 0,
          lru_hit: 0,
          net_hit: 0,
          lru_miss: 0,
          net_miss: 0,
          drop: 0,
          write_errs: 0,
          hotsize: 1
        });

        // Update

        saved.save$(function (err, modified) {

          expect(err).to.not.exist();
          expect(modified.b).to.equal(5);
          expect(modified.id).to.equal(id);

          seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

            expect(stats).to.contain({
              set: 2,
              get: 0,
              vinc: 1,
              vadd: 1,
              vmiss: 0,
              vhit: 0,
              lru_hit: 0,
              net_hit: 0,
              lru_miss: 0,
              net_miss: 0,
              drop: 0,
              write_errs: 0,
              hotsize: 2
            });

            // Load

            seneca.make(type).load$(id, function (err, loaded) {

              expect(err).to.not.exist();
              expect(loaded.a).to.equal(1);
              expect(loaded.b).to.equal(5);
              expect(loaded.id).to.equal(id);

              seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

                expect(stats).to.contain({
                  set: 2,
                  get: 1,
                  vinc: 1,
                  vadd: 1,
                  vmiss: 0,
                  vhit: 1,
                  lru_hit: 1,
                  net_hit: 0,
                  lru_miss: 0,
                  net_miss: 0,
                  drop: 0,
                  write_errs: 0,
                  hotsize: 2
                });

                // Remove

                loaded.remove$(function (err, out) {

                  expect(err).to.not.exist();
                  seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

                    expect(stats).to.contain({
                      set: 2,
                      get: 1,
                      vinc: 1,
                      vadd: 1,
                      vmiss: 0,
                      vhit: 1,
                      lru_hit: 1,
                      net_hit: 0,
                      lru_miss: 0,
                      net_miss: 0,
                      drop: 1,
                      write_errs: 0,
                      hotsize: 2
                    });

                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

describe('load()', function () {

  it('reports miss when item not found', function (done) {

    var seneca = Seneca({ log: 'silent' });
    seneca.use('memcached-cache');
    seneca.use('..');

    var type = internals.type();
    var entry = seneca.make(type);

    entry.load$('unknown', function (err, loaded) {

      expect(err).to.not.exist();
      expect(loaded).to.not.exist();

      seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

        expect(stats).to.contain({
          set: 0,
          get: 1,
          vinc: 0,
          vadd: 0,
          vmiss: 1,
          vhit: 0,
          lru_hit: 0,
          net_hit: 0,
          lru_miss: 0,
          net_miss: 0,
          drop: 0,
          write_errs: 0,
          hotsize: 0
        });

        done();
      });
    });
  });

  it('adds a record from full cache to lru cache', function (done) {

    var seneca = Seneca({ log: 'silent' });
    seneca.use('memcached-cache');

    internals.ready(seneca, function () {

      var type = internals.type();
      var entry = seneca.make(type, { a: 1 });

      // Save

      entry.save$(function (err, saved) {

        expect(err).to.not.exist();
        expect(saved.a).to.equal(entry.a);

        // Add vcache

        seneca.use('..');

        // Load

        seneca.make(type).load$(saved.id, function (err, loaded) {

          expect(err).to.not.exist();
          expect(loaded.a).to.equal(entry.a);
          expect(loaded.id).to.equal(saved.id);

          seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

            expect(stats).to.contain({
              set: 1,
              get: 1,
              vinc: 0,
              vadd: 1,
              vmiss: 1,
              vhit: 0,
              lru_hit: 0,
              net_hit: 0,
              lru_miss: 0,
              net_miss: 0,
              drop: 0,
              write_errs: 0,
              hotsize: 1
            });

            // Remove

            loaded.remove$(function (err, out) {

              expect(err).to.not.exist();
              done();
            });
          });
        });
      });
    });
  });

  it('handles evicted value from lru cache', function (done) {

    var seneca = Seneca({ log: 'silent' });
    seneca.use('memcached-cache');
    seneca.use('..', { maxhot: 1 });

    internals.ready(seneca, function () {

      var type = internals.type();
      var entry = seneca.make(type, { a: 1 });

      // Save

      entry.save$(function (err, saved1) {

        expect(err).to.not.exist();
        expect(saved1.a).to.equal(entry.a);

        // Save another

        var another = seneca.make(type, { a: 2 });
        another.save$(function (err, saved2) {

          expect(err).to.not.exist();

          // Load

          seneca.make(type).load$(saved1.id, function (err, loaded) {

            expect(err).to.not.exist();
            expect(loaded.a).to.equal(entry.a);
            expect(loaded.id).to.equal(saved1.id);

            seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

              expect(stats).to.contain({
                set: 2,
                get: 1,
                vinc: 0,
                vadd: 2,
                vmiss: 0,
                vhit: 1,
                lru_hit: 0,
                net_hit: 1,
                lru_miss: 1,
                net_miss: 0,
                drop: 0,
                write_errs: 0,
                hotsize: 1
              });

              // Remove

              saved1.remove$(function (err, out) {

                expect(err).to.not.exist();

                saved2.remove$(function (err, out) {

                  expect(err).to.not.exist();
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('handles evicted value from lru cache and upstream', function (done) {

    var seneca = Seneca({ log: 'silent' });
    seneca.use('memcached-cache');
    seneca.use('..', { maxhot: 1 });

    internals.ready(seneca, function () {

      var type = internals.type();
      var entry = seneca.make(type, { a: 1 });

      // Save

      entry.save$(function (err, saved1) {

        expect(err).to.not.exist();
        expect(saved1.a).to.equal(entry.a);

        // Save another

        var another = seneca.make(type, { a: 2 });
        another.save$(function (err, saved2) {

          expect(err).to.not.exist();

          // Drop from upstream cache

          seneca.act('role:cache, cmd:delete, key:seneca-vcache~d~0~-/-/' + type + '~' + saved1.id, function (err, result) {

            expect(err).to.not.exist();

            // Load

            seneca.make(type).load$(saved1.id, function (err, loaded) {

              expect(err).to.not.exist();
              expect(loaded).to.be.null();

              seneca.act('plugin:vcache, cmd:stats', function (err, stats) {

                expect(stats).to.contain({
                  set: 2,
                  get: 1,
                  vinc: 0,
                  vadd: 2,
                  vmiss: 0,
                  vhit: 1,
                  lru_hit: 0,
                  net_hit: 0,
                  lru_miss: 1,
                  net_miss: 1,
                  drop: 0,
                  write_errs: 0,
                  hotsize: 1
                });

                // Remove

                saved1.remove$(function (err, out) {

                  expect(err).to.not.exist();

                  saved2.remove$(function (err, out) {

                    expect(err).to.not.exist();
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

describe('list()', function () {

  it('returns list of entries', function (done) {

    var seneca = Seneca({ log: 'silent' });
    seneca.use('memcached-cache');
    seneca.use('..');

    var entry = seneca.make('foo', { a: 4 });
    entry.save$(function (err, saved) {

      expect(err).to.not.exist();
      entry.list$(function (err, list) {

        expect(err).to.not.exist();
        expect(list.length).to.equal(1);

        saved.remove$(function (err, out) {

          expect(err).to.not.exist();
          done();
        });
      });
    });
  });

  it('returns empty list', function (done) {

    var seneca = Seneca({ log: 'silent' });
    seneca.use('memcached-cache');
    seneca.use('..');

    internals.ready(seneca, function () {

      var entry = seneca.make('foo', { a: 5 });
      entry.list$(function (err, list) {

        expect(err).to.not.exist();
        expect(list.length).to.equal(0);
        done();
      });
    });
  });
});


internals.type = function () {

  return Crypto.randomBytes(8).toString('hex') + Date.now();
};


internals.ready = function (seneca, callback) {

  seneca.ready(function () {

    setImmediate(callback);             // Bypasses the try..catch operation in ready()
  });
};
