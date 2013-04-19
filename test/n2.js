"use strict";


var assert  = require('assert')
var request = require('request')

var seneca = require('seneca')()
seneca.use('mongo-store',{
  name:'senecatest',
  host:'127.0.0.1',
  port:27017,
})
seneca.use('memcached')
seneca.use('..')




function ef(win) {
  return function(err,out) {
    if( err ) return console.log(err);
    win(out)
  }
}


function wait(s,f) {
  console.log('WAIT '+s)
  setTimeout(f,s*1000)
}


request.get('http://localhost:3001/go',function(err,body,res){
  if( err ) return console.log(err)
  run_test()
})


function run_test() {

  var foo = seneca.make('foo')
  
  ;wait( 1, function(){
    
  ;foo.load$({a:1},ef(function(f1){
    assert.ok(null!=f1)

  ;foo.load$(f1.id,ef(function(f1){
    assert.ok(null!=f1)
    assert.equal(1,f1.a)

    f1.a=2
  ;f1.save$(ef(function(f1){
    
  ;seneca.act('plugin:vcache, cmd:stats')

  })) })) })) })
}
