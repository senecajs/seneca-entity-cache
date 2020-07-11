# @seneca/entity-cache

[Seneca](http://senecajs.org) plugin providing simple id-based distributed entity caching.

[![Npm][BadgeNpm]][Npm]
[![Travis][BadgeTravis]][Travis]
[![Coveralls][BadgeCoveralls]][Coveralls]
[![Maintainability](https://api.codeclimate.com/v1/badges/fcf0b82a1fc420fe7c33/maintainability)](https://codeclimate.com/github/senecajs/seneca-entity-cache/maintainability)
[![DeepScan grade](https://deepscan.io/api/teams/5016/projects/12818/branches/203965/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=5016&pid=12818&bid=203965)
[![dependencies Status](https://david-dm.org/senecajs/seneca-entity-cache/status.svg)](https://david-dm.org/senecajs/seneca-entity-cache)
[![Gitter][gitter-badge]][gitter-url]



### Node.js Seneca Versioned Caching module

This module is a plugin for the [Seneca framework](http://senecajs.org). 
It provides a data caching mechanism for [Seneca data entities](http://senecajs.org/data-entities.html).
Using this module will give your Seneca app a big performance boost.

The caching mechanism goes beyond simple key-based caching using
memcached.  In addition, a smaller "hot" cache is maintained within the
Node process. Data entities are given transient version numbers, and
these are used to synchronize the hot cache with memcached.

This plays nicely with multiple memcached instances, and allows Seneca apps to scale.

(See <a href="http://www.amazon.com/Beginning-Mobile-Application-Development-Cloud/dp/1118034694">chapter 8 of my book for details</a>, or read <i><a href="http://37signals.com/svn/posts/3113-how-key-based-cache-expiration-works">How key-based cache expiration works</a></i>)




### Quick example

This module works by wrapping the data entity actions (<i>role:entity, cmd:save, ...</i> etc). You just need to register it:

```JavaScript
var seneca = require('seneca')()
seneca.use('memcached-cache')
seneca.use('entity-cache')
```

Then just use data entities as normal. Except things will be a lot faster.


## Install

```sh
npm install seneca
npm install seneca-memcached-cache
npm install @seneca/entity-cache
```

You'll need the <a href="https://github.com/darsee/seneca-memcached-cache">seneca-memcached-cache</a> plugin as a dependency.

You'll also need [memcached](http://memcached.org/)

Or... you can use <a href="http://redis.io">redis</a>: <a href="https://github.com/darsee/seneca-redis-cache">seneca-redis-cache</a>.


## Testing

The unit tests require a running memcached and redis.



<!--START:options-->
<!--END:options-->


<!--START:action-list-->


## Action Patterns

* [cmd:stats,plugin:entity-cache](#-cmdstatspluginentity-cache-)


<!--END:action-list-->

<!--START:action-desc-->


## Action Descriptions

### &laquo; `cmd:stats,plugin:entity-cache` &raquo;

No description provided.



----------


<!--END:action-desc-->




### Options

Here's how to set the options (the values shown are the defaults):

```JavaScript
seneca.use('entity-cache',{
  prefix:  '@seneca/entity-cache',
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
mocha *.test.js --seneca.log.print
```

Also

```bash
cd test
memcached -vv
mongod --dbpath=db
node n1.js --seneca.log=type:plugin
node n2.js --seneca.log=type:plugin
```


[BadgeCoveralls]: https://coveralls.io/repos/senecajs/seneca-entity-cache/badge.svg?branch=master&service=github
[BadgeNpm]: https://badge.fury.io/js/%40seneca%2Fentity-cache.svg
[BadgeTravis]: https://travis-ci.org/senecajs/seneca-entity-cache.svg?branch=master
[Coveralls]: https://coveralls.io/github/senecajs/seneca-entity-cache?branch=master
[Npm]: https://www.npmjs.com/package/seneca-entity-cache
[Travis]: https://travis-ci.org/senecajs/seneca-entity-cache?branch=master
[gitter-badge]: https://badges.gitter.im/Join%20Chat.svg
[gitter-url]: https://gitter.im/senecajs/seneca
