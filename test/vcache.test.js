// Load modules

var SENECA_CACHE_PLUGIN = process.env.SENECA_CACHE_PLUGIN || 'memcached-cache'

var Util = require('util')
var Crypto = require('crypto')

var Code = require('code')
var Lab = require('lab')
var Seneca = require('seneca')
var Vcache = require('..')

// Declare internals

var internals = {}

// Test shortcuts

var lab = (exports.lab = Lab.script())
var describe = lab.describe
var it = make_it(lab)
var expect = Code.expect

process.setMaxListeners(0) // Remove warning caused by creating multiple framework instances

it('writes then reads a record', function(done) {
  var seneca = seneca_instance()

  seneca.ready(function() {
    var type = internals.type()
    var entry = seneca.make(type, { a: 1 })

    // Save
    entry.save$(function(err, saved) {
      expect(err).to.not.exist()
      expect(saved.a).to.equal(entry.a)

      seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
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
          cache_errs: 0,
          hotsize: 1
        })

        // Load

        seneca.make(type).load$(saved.id, function(err, loaded) {
          expect(err).to.not.exist()
          expect(loaded.a).to.equal(entry.a)
          expect(loaded.id).to.equal(saved.id)

          seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
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
              cache_errs: 0,
              hotsize: 1
            })

            // Remove

            loaded.remove$(function(err, out) {
              expect(err).to.not.exist()
              seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(
                err,
                stats
              ) {
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
                  cache_errs: 0,
                  hotsize: 1
                })

                done()
              })
            })
          })
        })
      })
    })
  })
})

it('updates a record', function(done) {
  var seneca = seneca_instance()

  seneca.ready(function() {
    var type = internals.type()
    var entry = seneca.make(type, { a: 1 })

    // Save

    entry.save$(function(err, saved) {
      var id = saved.id
      saved.b = 5

      seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
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
          cache_errs: 0,
          hotsize: 1
        })

        // Update

        saved.save$(function(err, modified) {
          expect(err).to.not.exist()
          expect(modified.b).to.equal(5)
          expect(modified.id).to.equal(id)

          seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
            expect(stats).to.contain({
              set: 2,
              get: 0,
              vmiss: 0,
              vhit: 0,
              lru_hit: 0,
              net_hit: 0,
              lru_miss: 0,
              net_miss: 0,
              drop: 0,
              cache_errs: 0
            })

            // Load

            seneca.make(type).load$(id, function(err, loaded) {
              expect(err).to.not.exist()
              expect(loaded.a).to.equal(1)
              expect(loaded.b).to.equal(5)
              expect(loaded.id).to.equal(id)

              seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(
                err,
                stats
              ) {
                expect(stats).to.contain({
                  set: 2,
                  get: 1,
                  vmiss: 0,
                  vhit: 1,
                  lru_hit: 1,
                  net_hit: 0,
                  lru_miss: 0,
                  net_miss: 0,
                  drop: 0,
                  cache_errs: 0
                })

                // Remove

                loaded.remove$(function(err, out) {
                  expect(err).to.not.exist()
                  seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(
                    err,
                    stats
                  ) {
                    expect(stats).to.contain({
                      set: 2,
                      get: 1,
                      vmiss: 0,
                      vhit: 1,
                      lru_hit: 1,
                      net_hit: 0,
                      lru_miss: 0,
                      net_miss: 0,
                      drop: 1,
                      cache_errs: 0
                    })

                    done()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})

describe('save()', function() {
  it('handles errors in upstream cache (incr)', function(done) {
    var seneca = Seneca().test()
    seneca.use('entity')
    seneca.use('./broken')
    seneca.use('..')

    seneca.ready(function() {
      var control = this.export(SENECA_CACHE_PLUGIN + '/control')
      control.incr = true

      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved) {
        expect(err).to.exist()

        seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
          expect(stats).to.contain({
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
            cache_errs: 1,
            hotsize: 0
          })

          done()
        })
      })
    })
  })

  it('handles errors lower priority entity service', function(done) {
    var seneca = Seneca().test()
    seneca.use('entity')
    seneca.use(SENECA_CACHE_PLUGIN)

    seneca.ready(function() {
      seneca.add({ role: 'entity', cmd: 'save' }, function bad_entity_save(
        ignore,
        callback
      ) {
        return callback(new Error('Bad entity service'))
      })

      seneca.use('..')

      seneca.ready(function() {
        var type = internals.type()
        var entry = seneca.make(type, { a: 1 })

        // Save

        entry.save$(function(err, saved) {
          expect(err).to.exist()
          done()
        })
      })
    })
  })

  it('handles upstream error when updating a record (writeData) - qqq', function(done) {
    var seneca = Seneca().test()
    //.quiet()
    seneca.use('entity')

    seneca.use('./broken')
    seneca.use('..')

    seneca.ready(function() {
      var control = this.export(SENECA_CACHE_PLUGIN + '/control')

      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved) {
        var id = saved.id
        saved.b = 5

        // Update

        control.set = true

        saved.save$(function(err, modified) {
          expect(err).to.exist()

          // Remove

          control.set = false

          saved.remove$(function(err, out) {
            expect(err).to.not.exist()
            seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(
              err,
              stats
            ) {
              expect(stats).to.contain({
                set: 1,
                get: 0,
                vadd: 1,
                vmiss: 0,
                vhit: 0,
                lru_hit: 0,
                net_hit: 0,
                lru_miss: 0,
                net_miss: 0,
                drop: 1,
                cache_errs: 1
              })

              done()
            })
          })
        })
      })
    })
  })
})

describe('load()', function() {
  it('handles an object criteria', function(done) {
    var seneca = seneca_instance()

    seneca.ready(function() {
      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved) {
        expect(err).to.not.exist()

        seneca.make(type).load$({ a: 1 }, function(err, loaded) {
          expect(err).to.not.exist()
          expect(loaded).to.exist()

          saved.remove$(function(err, out) {
            expect(err).to.not.exist()
            done()
          })
        })
      })
    })
  })

  it('skips an object criteria with multiple keys', function(done) {
    var seneca = seneca_instance()

    seneca.ready(function() {
      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved) {
        expect(err).to.not.exist()

        seneca.make(type).load$({ id: saved.id, a: 1 }, function(err, loaded) {
          expect(err).to.not.exist()
          expect(loaded).to.exist()

          saved.remove$(function(err, out) {
            expect(err).to.not.exist()
            done()
          })
        })
      })
    })
  })

  it('handles a number id', function(done) {
    var seneca = seneca_instance()

    seneca.ready(function() {
      var type = internals.type()
      var entry = seneca.make(type, { a: 10 })

      // Save

      entry.save$(function(err, saved) {
        expect(err).to.not.exist()

        seneca.make(type).load$(123, function(err, loaded) {
          expect(err).to.not.exist()
          // expect(loaded).to.not.exist();

          saved.remove$(function(err, out) {
            expect(err).to.not.exist()
            done()
          })
        })
      })
    })
  })

  it('reports miss when item not found', function(done) {
    var seneca = seneca_instance()

    var type = internals.type()
    var entry = seneca.make(type)

    seneca.make(type).load$('unknown', function(err, loaded) {
      expect(err).to.not.exist()
      expect(loaded).to.not.exist()

      seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
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
          cache_errs: 0,
          hotsize: 0
        })

        done()
      })
    })
  })

  it('adds a record from full cache to lru cache', function(done) {
    var seneca = seneca_instance()

    seneca.ready(function() {
      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved) {
        expect(err).to.not.exist()
        expect(saved.a).to.equal(entry.a)

        // Add vcache

        // Load

        seneca.make(type).load$(saved.id, function(err, loaded) {
          expect(err).to.not.exist()
          expect(loaded.a).to.equal(entry.a)
          expect(loaded.id).to.equal(saved.id)

          seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
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
              cache_errs: 0,
              hotsize: 1
            })

            // Remove

            loaded.remove$(function(err, out) {
              expect(err).to.not.exist()
              done()
            })
          })
        })
      })
    })
  })

  it('handles evicted value from lru cache', function(done) {
    var seneca = seneca_instance({ maxhot: 1 })

    seneca.ready(function() {
      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved1) {
        expect(err).to.not.exist()
        expect(saved1.a).to.equal(entry.a)

        // Save another

        var another = seneca.make(type, { a: 2 })
        another.save$(function(err, saved2) {
          expect(err).to.not.exist()

          // Load

          seneca.make(type).load$(saved1.id, function(err, loaded) {
            expect(err).to.not.exist()
            expect(loaded.a).to.equal(entry.a)
            expect(loaded.id).to.equal(saved1.id)

            seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(
              err,
              stats
            ) {
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
                cache_errs: 0,
                hotsize: 1
              })

              // Remove

              saved1.remove$(function(err, out) {
                expect(err).to.not.exist()

                saved2.remove$(function(err, out) {
                  expect(err).to.not.exist()
                  done()
                })
              })
            })
          })
        })
      })
    })
  })

  it('handles evicted value from lru cache and upstream', function(done) {
    var seneca = seneca_instance({ maxhot: 1 })

    seneca.ready(function() {
      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved1) {
        expect(err).to.not.exist()
        expect(saved1.a).to.equal(entry.a)

        // Save another

        var another = seneca.make(type, { a: 2 })
        another.save$(function(err, saved2) {
          expect(err).to.not.exist()

          // Drop from upstream cache

          seneca.act(
            'role:cache, cmd:delete, key:seneca-vcache~d~0~-/-/' +
              type +
              '~' +
              saved1.id,
            function(err, result) {
              expect(err).to.not.exist()

              // Load

              seneca.make(type).load$(saved1.id, function(err, loaded) {
                expect(err).to.not.exist()
                expect(loaded).to.be.null()

                seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(
                  err,
                  stats
                ) {
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
                    cache_errs: 0,
                    hotsize: 1
                  })

                  // Remove

                  saved1.remove$(function(err, out) {
                    expect(err).to.not.exist()

                    saved2.remove$(function(err, out) {
                      expect(err).to.not.exist()
                      done()
                    })
                  })
                })
              })
            }
          )
        })
      })
    })
  })

  it('errors on failed upstream vkey lookup', function(done) {
    var seneca = Seneca()
      .test()
      .quiet()
    seneca.use('entity')
    seneca.use('./broken') //, { disable: { get: true } });
    seneca.use('..')

    var type = internals.type()
    var entry = seneca.make(type)

    seneca.ready(function() {
      var control = this.export(SENECA_CACHE_PLUGIN + '/control')
      control.get = true

      seneca.make(type).load$('unknown', function(err, loaded) {
        expect(err).to.exist()
        expect(loaded).to.not.exist()

        seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
          expect(stats).to.contain({
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
            cache_errs: 1,
            hotsize: 0
          })

          done()
        })
      })
    })
  })

  it('passes lower priority load error', function(done) {
    var seneca = seneca_instance()

    seneca.ready(function() {
      seneca.add({ role: 'entity', cmd: 'load' }, function(ignore, callback) {
        return callback(new Error('Bad entity service'))
      })

      var type = internals.type()
      var entry = seneca.make(type)

      seneca.make(type).load$('unknown', function(err, loaded) {
        expect(err).to.exist()
        expect(loaded).to.not.exist()
        done()
      })
    })
  })

  it('handles upstream cache get error after value evicted from lru cache', function(done) {
    var seneca = Seneca().test()
    seneca.use('entity')

    //var disable = { get: false }
    seneca.use('./broken') //, { disable: disable })
    seneca.use('..', { maxhot: 1 })

    seneca.ready(function() {
      var control = this.export(SENECA_CACHE_PLUGIN + '/control')
      control.get = false

      var type = internals.type()
      var entry = seneca.make(type, { a: 1 })

      // Save

      entry.save$(function(err, saved1) {
        expect(err).to.not.exist()
        expect(saved1.a).to.equal(entry.a)

        // Save another

        var another = seneca.make(type, { a: 2 })
        another.save$(function(err, saved2) {
          expect(err).to.not.exist()

          // Load

          control.get = 1

          seneca.make(type).load$(saved1.id, function(err, loaded) {
            control.get = false

            expect(err).to.exist()
            expect(loaded).to.not.exist()

            seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(
              err,
              stats
            ) {
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
                net_miss: 0,
                drop: 0,
                cache_errs: 1,
                hotsize: 1
              })

              // Remove

              saved1.remove$(function(err, out) {
                expect(err).to.not.exist()

                saved2.remove$(function(err, out) {
                  expect(err).to.not.exist()
                  done()
                })
              })
            })
          })
        })
      })
    })
  })
})

describe('remove()', function() {
  it('passes lower priority remove error', function(done) {
    var seneca = seneca_instance()

    var type = internals.type()
    var entry = seneca.make(type)

    seneca.ready(function() {
      seneca.add({ role: 'entity', cmd: 'remove' }, function(ignore, callback) {
        return callback(new Error('Bad entity service'))
      })

      seneca.make(type, { id: 'none' }).remove$(function(err) {
        expect(err).to.exist()
        done()
      })
    })
  })

  it('skips unsupported id types', function(done) {
    var seneca = seneca_instance()

    var type = internals.type()
    var entry = seneca.make(type, { b: '123', a: 4 })

    entry.remove$(function(err) {
      expect(err).to.not.exist()
      done()
    })
  })

  it('errors on upstream set error', function(done) {
    var seneca = Seneca().test()
    seneca.use('entity')
    seneca.use('./broken') //, { disable: { set: true } })
    seneca.use('..')

    var type = internals.type()
    var entry = seneca.make(type)

    seneca.ready(function() {
      var control = this.export(SENECA_CACHE_PLUGIN + '/control')
      control.set = true

      seneca.make(type, { id: 'none' }).remove$(function(err) {
        expect(err).to.exist()

        seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
          expect(stats).to.contain({
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
            cache_errs: 1,
            hotsize: 0
          })

          done()
        })
      })
    })
  })
})

describe('list()', function() {
  it('returns list of entries', function(done) {
    var seneca = seneca_instance()

    var entry = seneca.make('foo', { a: 4 })
    entry.save$(function(err, saved) {
      expect(err).to.not.exist()
      entry.list$(function(err, list) {
        expect(err).to.not.exist()
        expect(list.length).to.equal(1)

        saved.remove$(function(err, out) {
          expect(err).to.not.exist()
          done()
        })
      })
    })
  })

  it('returns empty list', function(done) {
    var seneca = seneca_instance()

    seneca.ready(function() {
      var entry = seneca.make('foo', { a: 5 })
      entry.list$(function(err, list) {
        expect(err).to.not.exist()
        expect(list.length).to.equal(0)
        done()
      })
    })
  })
})

describe('registerHandlers()', function() {
  it('registers plugin with entities setting (object)', function(done) {
    var seneca = seneca_instance({ entities: [{ base: 'test' }] })

    var entry = seneca.make('test', 'foo', { a: 4 })
    entry.save$(function(err, saved) {
      var outside = seneca.make('foo', { a: 4 })
      outside.save$(function(err, outsideSaved) {
        expect(err).to.not.exist()
        seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
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
            cache_errs: 0,
            hotsize: 1
          })

          saved.remove$(function(err, out) {
            expect(err).to.not.exist()
            outsideSaved.remove$(function(err, out) {
              expect(err).to.not.exist()
              done()
            })
          })
        })
      })
    })
  })

  it('registers plugin with entities setting (string)', function(done) {
    var seneca = seneca_instance({ entities: ['-/test/-'] })

    var entry = seneca.make('test', 'foo', { a: 4 })
    entry.save$(function(err, saved) {
      var outside = seneca.make('foo', { a: 4 })
      outside.save$(function(err, outsideSaved) {
        expect(err).to.not.exist()
        seneca.act({ plugin: 'vcache', cmd: 'stats' }, function(err, stats) {
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
            cache_errs: 0,
            hotsize: 1
          })

          saved.remove$(function(err, out) {
            expect(err).to.not.exist()
            outsideSaved.remove$(function(err, out) {
              expect(err).to.not.exist()
              done()
            })
          })
        })
      })
    })
  })
})

internals.type = function() {
  return Crypto.randomBytes(8).toString('hex') + Date.now()
}

function make_it(lab) {
  return function it(name, opts, func) {
    if ('function' === typeof opts) {
      func = opts
      opts = {}
    }

    lab.it(
      name,
      opts,
      Util.promisify(function(x, fin) {
        func(fin)
      })
    )
  }
}

function seneca_instance(opts) {
  var seneca = Seneca().test()
  //.quiet()
  seneca.use('entity')
  seneca.use(SENECA_CACHE_PLUGIN)
  seneca.use('..', opts)
  return seneca
}
