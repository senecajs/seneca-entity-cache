/* Copyright (c) 2010-2014 Richard Rodger */
"use strict";


var assert = require('assert')


var seneca = require('seneca')
var shared = require('seneca-store-test')



var si = seneca({log:'silent'})
si.use('cache')
si.use('..')


si.__testcount = 0
var testcount = 0


describe('vcache', function(){
  it('basic', function(done){
    testcount++
    shared.basictest(si,done)
  })

  it('close', function(done){
    shared.closetest(si,testcount,done)
  })
})



