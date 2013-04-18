/* Copyright (c) 2012-2013 Richard Rodger, MIT License */
"use strict";


var _    = require('underscore')
var LRU  = require( 'lru-cache' )


// FIX: use default$ to handle no role:cache


module.exports = function( options, register ) { 
  var seneca = this
  var name = 'vcache'

  options   = seneca.util.deepextend({
    prefix: 'seneca-vcache',
    lrusize:1111,
    expires:3600
  }, options)



  var lrucache  = LRU(options.lrusize)

  var cacheapi = seneca.pin({
    role:'cache',
    cmd:'*'
  })

  var cmds = {}






  function ef(cb) {
    return function(win) {
      return function(err,out,v){
        err ? cb(err) : win(out,v)
      }
    }
  }


  function incr(ent,qstr,cb) {
    var er = ef(cb)
    var vkey = options.prefix+"~v~"+ent.canon$({string:true})+'~'+qstr

    cacheapi.incr({key:vkey,val:1}, er(function(done){
      if( done ) { 
        cb(null,done)
      }
      else {
        cacheapi.add( {key:vkey, val:0, expires:options.expires}, er(function(){
          cb(null,0)
        }))
      }
    }))
  }

  function set(ent,qstr,v,cb) {
    //var key = options.prefix+"~d~"+v+"~"+qstr
    var key = options.prefix+"~d~"+v+"~"+ent.canon$({string:true})+"~"+qstr
    lrucache.set( key, ent )
    cacheapi.set({key:key,val:ent.data$(),expires:options.expires},cb)
  }


  function get(qent,qstr,cb) {
    var er = ef(cb)
    var vkey = options.prefix+"~v~"+qent.canon$({string:true})+'~'+qstr

    cacheapi.get({key:vkey}, er(function(v){
      if( false === v ) {
        cb(null,null,0)
      }
      else {
        var key = options.prefix+"~d~"+v+"~"+qent.canon$({string:true})+"~"+qstr

        var out = lrucache.get(key)
        if( out ) {
          seneca.log('hit','lru',out,qstr,v)
          cb(null,out,v)
        }
        else {
          cacheapi.get({key:key},er(function(out){
            if( out ) {
              seneca.log('hit','net',out,qstr,v)
            }
            cb(null,out,v)
          }))
        }
      }
    }))
  }

  function makeqstr(q) {
    if( 'string'==typeof(q) ) {
      return q
    }
    else if( q.id && 1 == _.keys(q).length ) {
      return q.id
    }
    else {
      return JSON.stringify(q)
    }
  }


  cmds.save = function(args,cb) {
    var parent = this.parent
    var ent = args.ent
    var er = ef(cb)
    parent(args,er(function(ent){
      incr(ent,ent.id,er(function(v){
        set(ent,ent.id,v,er(function(){
          seneca.log('set',ent,ent.id,v)
          cb(null,ent)
        }))
      }))
    }))
  }


  cmds.load = function(args,cb) {
    var parent = this.parent
    var qent = args.qent
    var q    = args.q

    var er = ef(cb)
    var qstr = makeqstr(q)

    get(qent,qstr,er(function(out,v){
      if( out ) {
        var ent = qent.make$(out)
        cb(null,ent)
      }
      else {
        seneca.log('miss',qent,qstr,v)
        parent(args,er(function(out){
          if( out ) {
            set(out,qstr,v,er(function(){
              cb(null,out)
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
    var parent = this.parent
    var qent = args.qent
    var q    = args.q

    parent(args,cb)
  }


  // FIX: does not work if qstr != id or multiple qstr's used for load$
  cmds.remove = function(args,cb) {
    var parent = this.parent
    var qent = args.qent
    var q    = args.q

    var er = ef(cb)
    parent(args,er(function(out){
      var qstr = makeqstr(q)
      var vkey = options.prefix+"~v~"+qent.canon$({string:true})+'~'+qstr
      cacheapi.set({key:vkey,val:-1,expires:options.expires},er(function(){
        seneca.log('drop',qent,qstr)
        cb(null,out)
      }))
    }))
  }



  seneca.add({role:'entity',cmd:'save'},cmds.save)
  seneca.add({role:'entity',cmd:'load'},cmds.load)
  seneca.add({role:'entity',cmd:'list'},cmds.list)
  seneca.add({role:'entity',cmd:'remove'},cmds.remove)


  register(null,{
    name:name
  })
  
}

