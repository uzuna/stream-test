const util = require('util')
const Stream = require('stream')
const fs = require('fs');
const async = require('async');
const iconv = require('iconv-lite');
var Sample = require('./lib/streams_sample')
var Spipe = require('./lib/stream_pipe')
var through2 = require('through2');




// functions --------------------------
function stream_one(param, next){
	// console.time("post.csv")
	var time = Date.now();
	var counter = 0;
	var rs = fs.createReadStream('./data/KEN_ALL.CSV');
	var as = new Sample.AssertStream({listup:[]},{},function (stream, chunk, enc ,cb){
		chunk = iconv.decode(chunk, "shift_jis");
		chunk = stream._cache + chunk;
		chunk = chunk.split(/\r\n/);
		this._cache = chunk.pop();
		chunk.forEach(function (d) {
			if(/広島県/.test(d)) stream.listup.push(d);
		})
		counter++;
		cb();
	},function(stream){
		next(null, {
			memory:process.memoryUsage(), 
			time:Date.now() - time,
			result:stream.listup.length,
			counter:counter
		});
	})

	rs.pipe(as);
}

function stream_addpass(length ,next){
	// console.time("post.csv")
	var time = Date.now();
	var counter = 0;
	var pipes = []
	var rs = fs.createReadStream('./data/KEN_ALL.CSV');
	// var ls = new Spipe.lineStream({encode:'shift_jis'});
	var as = new Sample.AssertStream({listup:[]},{},function (stream, chunk, enc ,cb){
		// console.log(chunk.toString("shift_jis"));
		chunk = iconv.decode(chunk, "shift_jis");
		chunk = stream._cache + chunk;
		chunk = chunk.split(/\r\n/);
		this._cache = chunk.pop();
		// 
		chunk.forEach(function (d) {
			if(/広島県/.test(d)) stream.listup.push(d);
		})
		
		// console.log(chunk)
		counter++;
		cb();
	},function(stream){
		// console.timeEnd("post.csv")
		// console.log(counter,stream.listup.length)
		// console.log()
		next(null, {
			memory:process.memoryUsage(), 
			time:Date.now() - time,
			result:stream.listup.length,
			counter:counter
		});
	})

	pipes.push(rs);
	for(var i = 0; i < length; i++){
		pipes.push(new Stream.PassThrough());
	}
	pipes.push(as);

	// rs.pipe(as);
	joinPipe(pipes);
}

function onmemory(param, next){
	var time = Date.now();
	var obj = fs.readFileSync('./data/KEN_ALL.CSV');
	obj = iconv.decode(obj, "shift_jis")
	var counter = obj.split('\r\n').length;
	var listup = obj.split('\r\n').filter(function (d){
		return /広島県/.test(d);
	});
	next(null, {
		memory:process.memoryUsage(), 
		time:Date.now() - time,
		result:listup.length,
		counter:counter
	});
}


function stream_multi(para, next){
	// console.time("post.csv")
	var time = Date.now();
	var counter = 0;
	var rs = fs.createReadStream('./data/KEN_ALL.CSV');
	var ls = new Spipe.lineStream({encode:'shift_jis'});
	var as = new Sample.AssertStream({
		listup:[]
	},{
		objectMode:true
	},function (stream, chunk, enc ,cb){
		if(/広島県/.test(chunk)) stream.listup.push(chunk);
		counter++;
		cb();
	},function(stream){
		next(null, {
			memory:process.memoryUsage(), 
			time:Date.now() - time,
			result:stream.listup.length,
			counter:counter
		});
	})

	// rs.pipe(ls).pipe(cs).pipe(as);
	joinPipe([rs,ls,as]);
}



function joinPipe(ary){
	ary.reduce(function (a, b) {
		return a.pipe(b);
	})
}



var methods = {
	stream_one:stream_one,
	onmemory:onmemory,
	stream_addpass:stream_addpass,
	stream_multi:stream_multi,
}

// main------------------------

// measure("onmemory",10,30)

module.exports = measure;
function measure(method, param, loop, callback){
	callback = callback || function(){}
	var loopCount = [];
	for(var i=0;i<loop;i++){loopCount.push(i);}

	async.mapSeries(loopCount, function(item, next){
		// onmemory(function(err, result){
		// stream_addpass(10,function(err, result){
		// stream_addpass(100,function(err, result){
		// stream_multi(function(err, result){
		methods[method](param, function(err, result){
			console.log(Math.floor(result.memory.rss/1024/1024) +'MB',result.time + "ms");
			next(null, result);
		});
	},function(err, result){
		var timeavg = result.reduce(function (a,b) {
			return a+b.time;
		},0);
		timeavg = Math.floor(timeavg / result.length);
		var memory = Math.floor(result[result.length-1].memory.rss / 1024/1024);
		var counter = Math.floor(result[result.length-1].counter);
		var pickup = Math.floor(result[result.length-1].result);
		console.log(method, "complete", "avg:"+timeavg+ "ms");
		callback(null, {
			method:method,
			param:param,
			memory:memory,
			timeavg:timeavg,
			counter:counter,
			pickup:pickup
		})
	})
}
