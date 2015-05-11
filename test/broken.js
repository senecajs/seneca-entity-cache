var SenecaMemcachedCache = require('seneca-memcached-cache')


module.exports = function (options) {

  var seneca = this;

  var orig = seneca.add;

  seneca.add = function (criteria, fn) {

    orig.call(seneca, criteria, function (args, callback) {

      if (criteria.role && criteria.role === 'cache' &&
        options.disable && options.disable[criteria.cmd]) {

        if (options.disable[criteria.cmd] === true) {
          return callback(new Error('Invalid implementation'));
        }

        // Number if lives left

        --options.disable[criteria.cmd];
        if (options.disable[criteria.cmd] === 0) {
          options.disable[criteria.cmd] = true;
        }
      }

      return fn(args, callback);
    });
  };

  var result = SenecaMemcachedCache.call(seneca, options);

  seneca.add = orig;

  return result;
};
