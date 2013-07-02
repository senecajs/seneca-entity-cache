/* Copyright (c) 2012-2013 Richard Rodger, MIT License */
"use strict";


var _    = require('underscore')
var LRU  = require( 'lru-cache' )


// FIX: use default$ to handle no role:cache


module.exports = function( options, register ) { 
  var seneca = this
  var name = 'vcache'

  options   = seneca.util.deepextend({
    prefix:  'seneca-vcache',
    maxhot: 1111,
    expires: 3600
  }, options)



  var lrucache  = LRU(options.maxhot)


  var cacheapi = seneca.pin({
    role:'cache',
    cmd:'*'
  })

  var cmds = {}


  var stats = {
    start: new Date().getTime(),
    set:0,
    get:0,
    vinc:0,
    vadd:0,
    vmiss:0,
    vhit:0,
    lru_hit:0,
    net_hit:0,
    lru_miss:0,
    net_miss:0,
    drop:0
  }



  function ef(cb) {
    return function(win) {
      return function(err,out,v){
        err ? cb(err) : win(out,v)
      }
    }
  }


  function incr(ent,id,cb) {
    var er = ef(cb)
    var vkey = options.prefix+"~v~"+ent.canon$({string:true})+'~'+id

    cacheapi.incr({key:vkey,val:1}, er(function(done){
      if( done ) { 
        stats.vinc++
        cb(null,done)
      }
      else {
        cacheapi.add( {key:vkey, val:0, expires:options.expires}, er(function(){
          stats.vadd++
          cb(null,0)
        }))
      }
    }))
  }


  function setdata(ent,id,v,cb) {
    var key = options.prefix+"~d~"+v+"~"+ent.canon$({string:true})+"~"+id
    seneca.log.debug('set',key)

    lrucache.set( key, ent )
    cacheapi.set({key:key,val:ent.data$(),expires:options.expires},function(err,out){
      stats.set++
      cb(err,out)
    })
  }




  function get(qent,id,cb) {
    var er = ef(cb)
    var vkey = options.prefix+'~v~'+qent.canon$({string:true})+'~'+id

    cacheapi.get({key:vkey}, er(function(v){
      stats.get++
      if( false === v ) {
        stats.vmiss++
        seneca.log.debug('miss','version',vkey)
        cb(null,null,0)
      }
      else {
        stats.vhit++

        var key = options.prefix+"~d~"+v+"~"+qent.canon$({string:true})+"~"+id

        var out = lrucache.get(key)
        if( out ) {
          seneca.log.debug('hit','lru',key)
          stats.lru_hit++
          cb(null,out,v)
        }
        else {
          seneca.log.debug('miss','lru',key)
          stats.lru_miss++
          cacheapi.get({key:key},er(function(ent){
            if( ent ) {
              stats.net_hit++
              seneca.log.debug('hit','net',key)
            }
            else {
              stats.net_miss++
              seneca.log.debug('miss','net',key)
            }
            cb(null,ent,v)
          }))
        }
      }
    }))
  }

  
  // vcache only works with ent.id
  function makequery(q) {
    if( _.isString(q) || _.isNumber(q) ) {
      return q
    }
    else if( q.id && 1 == _.keys(q).length ) {
      return q.id
    }
    else {
      return null
    }
  }



  cmds.save = function(args,cb) {
    var seneca = this
    var prior = this.prior
    var ent = args.ent
    var er = ef(cb)
    prior(args,er(function(ent){
      incr(ent,ent.id,er(function(v){
        setdata(ent,ent.id,v,er(function(){
          seneca.log.debug('set',ent,ent.id,v)
          cb(null,ent)
        }))
      }))
    }))
  }


  cmds.load = function(args,cb) {
    var seneca = this
    var prior = this.prior
    var qent = args.qent
    var q    = args.q

    var er = ef(cb)
    var id = makequery(q)

    if( null == id ) {
      return prior(args,cb)
    }

    get(qent,id,er(function(out,v){
      if( out ) {
        var ent = qent.make$(out)
        cb(null,ent)
      }
      else {
        seneca.log.debug('miss',qent,id,v)
        prior(args,er(function(ent){
          if( ent ) {
            setdata(ent,ent.id,v,er(function(){
              cb(null,ent)
            }))
          }
          else {
            cb(null,null)
          }
        }))
      }
    }))
  }


  cmds.list = function(args,cb) {
    var prior = this.prior
    var qent = args.qent
    var q    = args.q

    prior(args,cb)
  }


  cmds.remove = function(args,cb) {
    var prior = this.prior
    var qent = args.qent
    var q    = args.q

    var er = ef(cb)
    prior(args,er(function(ent){
      var id = makequery(q)
      if( null == id ) {
        return cb(null,ent)
      }

      var vkey = options.prefix+"~v~"+qent.canon$({string:true})+'~'+id
      cacheapi.set({key:vkey,val:-1,expires:options.expires},er(function(){
        stats.drop++
        seneca.log.debug('drop',vkey)
        cb(null,ent)
      }))
    }))
  }



  seneca.add({role:'entity',cmd:'save'},cmds.save)
  seneca.add({role:'entity',cmd:'load'},cmds.load)
  seneca.add({role:'entity',cmd:'list'},cmds.list)
  seneca.add({role:'entity',cmd:'remove'},cmds.remove)


  seneca.add({plugin:'vcache',cmd:'stats'},function(args,done){
    var out = _.clone(stats)
    out.hotsize = lrucache.keys().length
    out.end = new Date().getTime()
    seneca.log.debug('stats',out)
    done(null,out)
  })

  register(null,{
    name:name
  })
  
}

