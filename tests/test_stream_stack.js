const util = require('util')
const Stream = require('stream')
const fs = require('fs');
const iconv = require('iconv-lite');
var Sample = require('../lib/streams_sample')
var Spipe = require('../lib/stream_pipe')
var through2 = require('through2');

describe("stack", function(){
	it('timer', function(done) {
		this.timeout(6000);
		var gen = new Sample.TimerStream(100,2000);
		var as = new Sample.AssertStream({},{},
			function (stream, chunk, state, callback){
				console.log(chunk.toString())
				callback();
			},function (stream){
				done(); 
		});
		gen.pipe(as);
	})

	it("through2", function (done) {
		this.timeout(6000);
		var gen = new Sample.TimerStream(100,2000);
		var thStream = through2(
			function transform(chunk, enc, next){
				next(null, chunk)
			},function flush(cb){
				cb();
				done();
		});
		gen.pipe(thStream);
	});

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

	it('postcsv', function (done) {
		this.timeout(10*1000);

		console.time("post.csv")
		var counter = 0;
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
			console.timeEnd("post.csv")
			console.log(counter,stream.listup.length)
			done();
		})

		rs.pipe(as);
	})

	it('post pass', function (done) {
		this.timeout(10*1000);

		console.time("post.pass")
		var counter = 0;
		var rs = fs.createReadStream('./data/KEN_ALL.CSV');
		var ls = new Spipe.lineStream({encode:'shift_jis'});
		var pass = new Stream.PassThrough()
		var as = new Sample.AssertStream({listup:[]},{},function (stream, chunk, enc ,cb){
			// console.log(chunk.toString("shift_jis"));
			// chunk = iconv.decode(chunk, "shift_jis");
			if(/広島県/.test(chunk)) stream.listup.push(chunk);
			// console.log(chunk)
			counter++;
			cb();
		},function(stream){
			console.timeEnd("post.pass")
			console.log(counter,stream.listup.length)
			done();
		})

		// rs.pipe(ls).pipe(pass).pipe(as);
		joinPipe([rs,ls,pass,as]);
	})

	it('postcsv', function (done) {
		this.timeout(10*1000);

		console.time("post.csv")
		var counter = 0;
		var rs = fs.createReadStream('./data/KEN_ALL.CSV');
		var ls = new Spipe.lineStream({encode:'shift_jis'});
		var cs = new Spipe.CsvStream({
			encode:'shift_jis',
			// toJSON: true
		});
		var as = new Spipe.AssertStream({
			listup:[]
		},function (strema, chunk, enc ,cb){
			// console.log(chunk.toString("shift_jis"));
			// chunk = iconv.decode(chunk, "shift_jis");
			// console.log(chunk)
			if(/広島県/.test(chunk)) stream.listup.push(chunk);
			counter++;
			cb();
		},function(stream){
			console.timeEnd("post.csv")
			console.log(counter,stream.listup.length)
			console.log(process.memoryUsage())
			done();
		})

		rs.pipe(ls).pipe(cs).pipe(as);
	})

	it('postcsv buffer', function (done) {
		this.timeout(10*1000);
		console.time("post.csv")
		var obj = fs.readFileSync('./data/KEN_ALL.CSV');
		obj = iconv.decode(obj, "shift_jis")
		// console.log(typeof obj, obj.length)
		var counter = obj.split('\r\n').length;
		var listup = obj.split('\r\n').filter(function (d){
			// d = iconv.decode(d, "shift_jis")
			// console.log(d);
			// process.exit();
			return /広島県/.test(d);
		});

		console.timeEnd("post.csv")
		console.log(counter,listup.length)
		console.log(process.memoryUsage())
		done();
	})
})

// write Stream -> mysql

//
function joinPipe(ary){
	ary.reduce(function (a, b) {
		return a.pipe(b);
	})
}