var SenecaCache = require('@seneca/' +
  (process.env.SENECA_CACHE_PLUGIN || 'memcached-cache'))

//console.log(SenecaCache)

module.exports = function (options) {
  var seneca = this
  var control = { broken: true }

  var orig = seneca.add

  seneca.add = function (criteria, fn) {
    orig.call(seneca, criteria, function (args, callback, meta) {
      //console.log('BROKEN', control, criteria)

      if (
        criteria.role &&
        criteria.role === 'cache' &&
        control &&
        control[criteria.cmd]
      ) {
        if (control[criteria.cmd] === true) {
          return callback(new Error('Invalid implementation'))
        }

        // Number if lives left

        --control[criteria.cmd]
        if (control[criteria.cmd] === 0) {
          control[criteria.cmd] = true
        }
      }

      return fn(args, callback, meta)
    })
  }

  var result = SenecaCache.call(seneca, options)

  result.exports = {
    control: control,
  }

  seneca.add = orig

  return result
}
