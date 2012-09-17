/* Copyright (c) 2012 Richard Rodger */


var _    = require('underscore')
var LRU  = require( 'lru-cache' )


function err( cb ) {
  return function(err,out) {
    if( err ) return cb(err);
    win(out)
  }
}







function VCachePlugin() {
  var self = {}
  self.name = 'vcache'


  var seneca
  var lrucache

  var opts


  // TODO: collect stats


  function ef(cb) {
    return function(win) {
      return function(err,out,v){
        err ? cb(err) : win(out,v)
      }
    }
  }


  function incr(ent,qstr,cb) {
    var er = ef(cb)
    var vkey = opts.prefix+"~v~"+ent.canon$({string:true})+'~'+qstr

    cacheapi.incr({key:vkey,val:1}, er(function(done){
      if( done ) { 
        cb(null,done)
      }
      else {
        cacheapi.add( {key:vkey, val:0, expires:opts.expires}, er(function(){
          cb(null,0)
        }))
      }
    }))
  }

  function set(ent,qstr,v,cb) {
    //var key = opts.prefix+"~d~"+v+"~"+qstr
    var key = opts.prefix+"~d~"+v+"~"+ent.canon$({string:true})+"~"+qstr
    lrucache.set( key, ent )
    cacheapi.set({key:key,val:ent.data$(),expires:opts.expires},cb)
  }


  function get(qent,qstr,cb) {
    var er = ef(cb)
    var vkey = opts.prefix+"~v~"+qent.canon$({string:true})+'~'+qstr

    cacheapi.get({key:vkey}, er(function(v){
      if( false === v ) {
        cb(null,null,0)
      }
      else {
        var key = opts.prefix+"~d~"+v+"~"+qent.canon$({string:true})+"~"+qstr

        var out = lrucache.get(key)
        if( out ) {
          seneca.log('hit','lru',out,qstr,v)
          //console.log('lru hit: '+key)
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


  function validargs(args) {
    if( !args.parent$ ) { throw new Error('vache requires a previosuly registered data store plugin') }
  }


  self.save = function(args,cb) {
    validargs(args)

    var ent = args.ent
    var er = ef(cb)
    args.parent$(args,er(function(ent){
      incr(ent,ent.id,er(function(v){
        set(ent,ent.id,v,er(function(){
          seneca.log('set',ent,ent.id,v)
          cb(null,ent)
        }))
      }))
    }))
  }


  self.load = function(args,cb) {
    validargs(args)

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
        args.parent$(args,er(function(out){
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


  self.list = function(args,cb) {
    validargs(args)

    var qent = args.qent
    var q    = args.q

    args.parent$(args,cb)
  }


  // FIX: does not work if qstr != id or multiple qstr's used for load$
  self.remove = function(args,cb) {
    validargs(args)

    var qent = args.qent
    var q    = args.q

    var er = ef(cb)
    args.parent$(args,er(function(out){
      var qstr = makeqstr(q)
      var vkey = opts.prefix+"~v~"+qent.canon$({string:true})+'~'+qstr
      cacheapi.set({key:vkey,val:-1,expires:opts.expires},er(function(){
        seneca.log('drop',qent,qstr)
        cb(null,out)
      }))
    }))
  }


  self.close = function(args,cb){
    seneca.log('close')
    cacheapi.close(args,cb)
  }




  self.init = function(si,initopts,cb) {
    seneca = si
    opts   = _.extend({
      prefix: 'seneca',
      lrusize:1111,
      expires:3600
    },initopts)

    var role = 'entity'

    seneca.add({on:role,cmd:'save'},self.save)
    seneca.add({on:role,cmd:'load'},self.load)
    seneca.add({on:role,cmd:'list'},self.list)
    seneca.add({on:role,cmd:'remove'},self.remove)

    seneca.add({role:'seneca',cmd:'close'},self.close)

    cacheapi = seneca.pin({
      role:'cache',
      cmd:'*'
    })

    lrucache  = LRU(opts.lrusize)

    cb()
  }


  return self
}


exports.plugin = function() {
  return new VCachePlugin()
}

