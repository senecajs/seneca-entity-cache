"use strict";


var assert  = require('assert')
var connect = require('connect')

var seneca = require('seneca')()
seneca.use('jsonfile-store',{folder:__dirname+'/data'})
seneca.use('memcached-cache')
seneca.use('..')


seneca.ready( function() {
  var foo = seneca.make('foo',{a:1})

  foo.load$({a:1},ef(function(f1){
    if( f1 ) { f1.remove$(ef()) }
  }))

  foo.load$({a:2},ef(function(f1){
    if( f1 ) { f1.remove$(ef()) }
  }))
})

var app = connect()

app.use(function(req,res,next){
  if( '/go' == req.url ) {
    res.writeHead(200)
    res.end('ok')
    run_test()
  }
  else next()
})


app.listen(3001)


function ef(win) {
  return function(err,out) {
    if( err ) return console.log(err);
    win && win(out)
  }
}


function wait(s,f) {
  console.log('WAIT '+s)
  setTimeout(f,s*100)
}


function run_test() {

  var f1 = seneca.make('foo',{a:1})

  ;f1.save$(ef(function(f1){
    assert.ok(null!=f1)

  ;wait( 2, function(){

  ;f1.load$(f1.id,ef(function(f1){
    assert.ok(null!=f1)
    assert.equal(2,f1.a)

  ;seneca.act('plugin:vcache, cmd:stats',console.log)

  })) }) }))
}
