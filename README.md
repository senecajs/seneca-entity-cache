# seneca-vcache

### Node.js Seneca Versioned Caching module

This module is a plugin for the [Seneca framework](http://senecajs.org). 
It provides a data caching mechanism for [Seneca data entities](http://senecajs.org/data-entities.html).
Using this module will give your Seneca app a big performance boost.

The caching mechanism goes beyond simple key-based caching using
memcached.  In addition a smaller "hot" cache is maintained within the
Node process. Data entities are given transient version numbers, and
these are used to synchronize the hot cache with memcached.

(See <a href="http://www.amazon.com/Beginning-Mobile-Application-Development-Cloud/dp/1118034694">chapter 8 of my book for details</a>, or read <i><a href="http://37signals.com/svn/posts/3113-how-key-based-cache-expiration-works">How key-based cache expiration works</a></i>)


### Support

If you're using this module, feel free to contact me on twitter if you
have any questions! :) [@rjrodger](http://twitter.com/rjrodger)

Current Version: 0.2.0

Tested on: node 0.8.16, seneca 0.5.6



### Quick example

This module works by wrapping the data entity actions (<i>role:entity, cmd:save, ...</i> etc). You just need to register it:

```JavaScript
var seneca = require('seneca')()
seneca.use('memcached')
seneca.use('vcache')
```

Then just use data entities as normal. Except things will be a lot faster.


## Install

```sh
npm install seneca
npm install seneca-memcached
npm install seneca-vcache
```

You'll need the <a href="https://github.com/rjrodger/seneca-memcached">seneca-memcached</a> plugin as a dependency.

You'll also need [memcached](http://memecached.org/)


## Actions

### _plugin:vcache, cmd:stats_

Returns a JSON object containing the current hit/miss counts of the cache.


### Options

Here's how to set the options (the values shown are the defaults):

```JavaScript
seneca.use('vcache',{
  prefix:  'seneca-vcache',
  maxhot:  1111,
  expires: 3600
})
```

Where:

   * _prefix_: prefix string to namespace your cache (useful if your cache is used by other things)
   * _maxhot_: the maximum number of hot items to store in the running node process memory
   * _expires_: how long to store items (in seconds)


## Test

```bash
cd test
mocha store.test.js --seneca.log.print
```

Also

```bash
cd test
memcached -vv
mongod --dbpath=db
node n1.js --seneca.log=type:plugin
node n2.js --seneca.log=type:plugin
```
