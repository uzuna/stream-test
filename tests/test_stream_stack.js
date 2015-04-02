const util = require('util')
const Stream = require('stream')
const fs = require('fs');
var Sample = require('../lib/streams_sample')
var Spipe = require('../lib/stream_pipe')
var through2 = require('through2');

describe("stack", function(){
	// it('timer', function(done) {
	// 	this.timeout(6000);
	// 	var gen = new Sample.TimerStream(100,2000);
	// 	var as = new Sample.AssertStream({},{},
	// 		function (stream, chunk, state, callback){
	// 			console.log(chunk.toString())
	// 			callback();
	// 		},function (stream){
	// 			done(); 
	// 	});
	// 	gen.pipe(as);
	// })

	// it("through2", function (done) {
	// 	this.timeout(6000);
	// 	var gen = new Sample.TimerStream(100,2000);
	// 	var thStream = through2(
	// 		function transform(chunk, enc, next){
	// 			next(null, chunk)
	// 		},function flush(cb){
	// 			cb();
	// 			done();
	// 	});
	// 	gen.pipe(thStream);
	// });

	// gen -> as -> fall

	it("length", function (done) {
		this.timeout(4000)
		// console.log(Sample)
		var gen = new Sample.LengthStream(30);
		var as = new Sample.AssertStream({},{
			highWaterMark:10
		},
			function (stream, chunk, state, callback){
				console.log("[pendCheck]",chunk.toString())
				stream.push(chunk);	// push next
				callback();
			},function (stream){
				console.log("Complete sample")
				// done(); 
		});

		//  cork
		var fall = new Sample.AssertStream(function (stream) {
			stream.cork();
			setTimeout(function(){
				stream.uncork();
			},2000)
		},{
			highWaterMark:10
		},
			function (stream, chunk, state, callback){
				console.log("[fall]", chunk.toString());

				stream.push(chunk.toString()+"\r\n");
				setTimeout(callback,50)
				// callback();
			},function (stream){
				done();
		});

		as.on("pause", function(){
			console.log("[pend pause]",fall._readableState.length)
		})
		fall.on("drain", function(){
			console.log("[fall drain]",as._readableState.length)
		})

		var ws = fs.createWriteStream("testout.txt", "utf8");

		gen.pipe(as).pipe(fall).pipe(ws);
	})
})

// write Stream -> mysql