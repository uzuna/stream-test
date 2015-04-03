const util = require('util')
const Stream = require('stream')
const fs = require('fs');
var Sample = require('./lib/streams_sample')

// Generate Stream
var gen = new Sample.LengthStream(30);

// monitor forward
var as = new Sample.AssertStream({},{
	highWaterMark:10,
	// objectMode:true
},
	function (stream, chunk, state, callback){
		console.log("[be]",chunk.toString())
		stream.push(chunk);	// push next
		callback();
	},function (stream){
		console.log("[finish] Before monitor")
});

// monitor backward
var fall = new Sample.AssertStream(function (stream) {
	stream.cork();
	setTimeout(function(){
		stream.uncork();
	},2000)
},{
	highWaterMark:5,
	// objectMode:true
},
	function (stream, chunk, state, callback){
		// Flow Control
		console.log("[after]", chunk.toString());
		stream.push(chunk.toString()+"\r\n");
		setTimeout(callback,50)
	},function (stream){
		// done();
		console.log("[Finish] After monitor")
});

// Event moniter
gen.on("pause", function(){
	console.log("[gene pause] before cache length = ",as._writableState.length)
})
as.on("pause", function(){
	console.log("[before pause] after cache length = ",fall._writableState.length)
})
as.on("drain", function(){
	console.log("[before drain] before cache length = ",as._writableState.length)
})
fall.on("drain", function(){
	console.log("[after drain] after cache length = ",fall._writableState.length)
})

// create ourput stream
var ws = fs.createWriteStream("testout.txt", "utf8");

// piping
gen.pipe(as).pipe(fall).pipe(ws);