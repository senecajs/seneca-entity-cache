"use strict";


var connect = require('connect')

var seneca = require('seneca')()
seneca.use('mongo-store',{
  name:'senecatest',
  host:'127.0.0.1',
  port:27017,
})
seneca.use('memcached')
seneca.use('..')


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
    win(out)
  }
}


function run_test() {

  var f1 = seneca.make('foo',{a:1})
  f1.save$(ef(function(f1){

  }))
}