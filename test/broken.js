module.exports = function (options) {

  var fail = function (ignore, callback) {

    setImmediate(function () {

      return callback(new Error('Invalid implementation'));
    });
  };

  this.add({ role: 'cache', cmd: 'set' }, fail);
  this.add({ role: 'cache', cmd: 'get' }, fail);
  this.add({ role: 'cache', cmd: 'add' }, fail);
  this.add({ role: 'cache', cmd: 'delete' }, fail);
  this.add({ role: 'cache', cmd: 'incr' }, fail);
  this.add({ role: 'cache', cmd: 'decr' }, fail);

  return { name: 'broken' };
};
