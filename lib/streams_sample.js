const util = require('util')
const fs = require('fs');
const path = require('path');
const Stream = require('stream');
require('date-utils');

// コンソールに色をつける
var black   = '\u001b[30m';
var red     = '\u001b[31m';
var green   = '\u001b[32m';
var yellow  = '\u001b[33m';
var blue    = '\u001b[34m';
var magenta = '\u001b[35m';
var cyan    = '\u001b[36m';
var white   = '\u001b[37m';
var reset   = '\u001b[0m';

// 外部公開
module.exports = StreamSample


function isNum(v){
	if(typeof(v) === 'number') return true;
	return false;
}

function isFunction(arg) {
	return typeof arg === 'function';
}

function StreamSample(){

}


// ------------------------------
// Timer Stream
//　定時に発信するモジュール
// ------------------------------
function TimerStream(interval, limit){

	Stream.Readable.call(this);
	interval = isNum(interval) ? interval : undefined;
	this.interval = interval || 100; // interval

	this.limit = isNum(limit) ? limit : 5000;
	this._index = 0;
	this._timeout = null;
}
util.inherits(TimerStream, Stream.Readable);

// 発信開始
TimerStream.prototype._read = function(){
	var self = this;
	if(this.limit > 1){
		this._index += this.interval;
		if(this._index > this.limit) {
			clearTimeout(this._timeout);
			return this.push(null);
		}
	}

	this._timeout = setTimeout(function(){
		var rs = self.push(new Date().toFormat("YYYY MM DD HH24 MI SS LL"), "utf8");
		if(!rs){
			console.log("[Push Error!!]", self._readableState.needReadable );
		}
	},this.interval)
}


StreamSample.TimerStream = TimerStream;

// ---------------------------------------
// lengthStream
function LengthStream(length, option){
	Stream.Readable.call(this);
	this.length = isNum(length) ? length : 30;
	this._index = 0;
}
util.inherits(LengthStream, Stream.Readable);

LengthStream.prototype._read = function(){
	if(this._index > this.length) {
		return this.push(null);
	}
	this.push(this._index.toString())
	this._index++
}
StreamSample.LengthStream = LengthStream;

// ----------------------
// readble stream
var consoleStream = function(match){
	var self = this;
	Stream.Transform.call(this);
	
  // check data flow rate
  this._flow = 0;
  this._flowAve = 0;
  this._start = 0;

  this.once("data", function(){
  	self._start = new Date();
  });

  this.once("result", function(rs){
  	console.log("[Flow]",rs);
  });

  // 平均流量計はpidで評価?
  this.match = match || "00";
}
util.inherits(consoleStream, Stream.Transform);


consoleStream.prototype._flush = function(callback) {
	var end = new Date();
	// callback();
	this.emit("result",{
		total: this._flow,
		start: this._start,
		end:end,
		rangemilliSec : (end - this._start),
		rateMBytes : Math.round(this._flow /(end - this._start))/1000
		, memory : process.memoryUsage()
	});

	this._transform(new Buffer(0), '', callback);
}

// write関数 = 先のパイプから書き込まれる場所
consoleStream.prototype._transform = function(data, state, cb){
	// console.log(data.);
  var df = data.toString();
	// if(df.match(this.match)){
	// 	console.log("[match 00]", df);
	// }
	// dlow moniter data流量計
	this._flow += data.toString().length;
  // this.emit("data",data); // pipeをチェーンするなら自分自身にもデータが着たと知らせなければならない
  this.push(data);
  cb();
}


StreamSample.consoleStream = consoleStream;
// pipe collectorが間にたってinstanceをつくる


// ストリームされたデータをメモリ上に保持してまとめて返す
var stackStream = function(cb){
	var option = {
		decodeStrings: true,
		highWaterMark:16
	}
	var self = this;
	Stream.Writable.call(this, option);
	this._callback = cb;
	this._stackStream = [];
	this.on("finish", function(){
		cb(null, self._stackStream)
	})
}
util.inherits(stackStream, Stream.Writable);

// デフォルトencodingを指定できるはずだが...
stackStream.prototype._write = function (chunk, encoding, callback){
	encoding = (encoding!=='buffer')? encoding : 'utf8';
	this._stackStream.push(chunk.toString(encoding));
	// this._stackStream.push(chunk);
	callback();
}

StreamSample.stackStream = stackStream;


// sampling pipe
// csv等のファイルを判定する為にファイルの一部を条件で切り取って、ある程度とったらendを元パイプに返す
// スタック拡張といえるサンプリングパイプを作る
// pipeイベント発生時にreadableが渡されるのでそれを保持して、適当なところでunpipeする
var samplingStream = function (match, limit, option, cb){
	if(arguments.length < 1) throw new TypeError("Insufficient arguments < 1");
	else if(arguments.length < 2){
		if(isFunction(match)) {
			cb = match;
			match = undefined;
		}
	}else if(arguments.length < 3){
		if(isFunction(limit)) {
			cb = limit;
			limit = undefined;
		}
	}else{
		if(isFunction(option)) {
			cb = option;
			option = undefined;
		}
	}

	Stream.Writable.call(this);
	var self = this;
	
	// sampling process
	match = match || /\r\n/;
	if(match instanceof RegExp){
		this.match = match;
	}
	else if(match instanceof String){
		this.match = match;
	}
	else{
		throw new TypeError("unmatch sampling pattrn String or RegExp");
	}

	if(typeof(limit) !== 'number')
		limit = undefined
	this.limit = limit || 20;


	this._stackStream = [];
	this._index = 0;
	this._cache = "";

	// stackができたら呼ばれる
	this.on("finish", function(){
		cb(null, self._stackStream)
	})

	// errorが発生したら呼ばれる
	this.on("error", function(err){
		throw err;
		cb(err, self._stackStream)
	})

	// pipeイベント発生時にreadableが渡されるのでそれを保持して、適当なところでunpipeする
	this.on("pipe", function (src){
		self._src = src;
	})
}
util.inherits(samplingStream, Stream.Writable);


// chunkを読み込んで区切りに沿って細分化する
samplingStream.prototype._write = function (chunk, encoding, callback){
	encoding = (encoding!=='buffer')? encoding : 'utf8';
	chunk = this._cache + chunk.toString(encoding)

	if(chunk.match(this.match)){
		var list = chunk.split(this.match);
		this._cache = list.unshift();
		this._index += list.length;
		this._stackStream = this._stackStream.concat(list);
	}
	if(this._index > this.limit){
		this._src.unpipe(this);	//親のパイプを切断
		this.end();	// 自身に終了を通知
	}
	callback();
}

StreamSample.samplingStream = samplingStream;


// --------
// 減速テスト

// var timerStream = new TimerStream();
// var cst = new consoleStream();


// // streampipeをつないでいる
// // 結局pipeとはwrite関数を呼び出すものという理解でいいみたい?
// timerStream.pipe(cst).pipe(fs.WriteStream("watch/timer.txt"));
// // timerStream.pipe(fs.WriteStream("watch/timer.txt"));
// timerStream.resume();


// websocketに流し込む為のもの
var WebsocketStream = function(socket, option, cb){

	if(!("emit" in socket)) throw new TypeError("socket has not emit function");
	if(!(socket.emit instanceof Function)) throw new TypeError("socket has not emit function");
	this._ioSocket = socket;

	if (!isFunction(cb)) cb = function(){}

	option = option || {}
	this.category = option.category || 'message'
	this.decodeStrings  = option.decodeStrings  || false
	this._dataTotal = 0;

	var self = this;
	Stream.Writable.call(this, option);
	this._callback = cb;
	this.on("drain", function(){
		console.log("[Drain Event]");
	})
	this.on("finish", function(){
		cb(null, self._dataTotal)
	})
}
util.inherits(WebsocketStream, Stream.Writable);

WebsocketStream.prototype._write = function (chunk, encoding, callback){
	if(this.objectMode){
		chunk = JSON.stringify(chunk);
	}else{
		encoding = (encoding!=='buffer')? encoding : 'utf8';
		chunk = chunk.toString(encoding)
	}
	
	this._dataTotal += chunk.length
	this._ioSocket.emit(this.category, chunk)
	callback();
}

StreamSample.WebsocketStream = WebsocketStream;



// ----------------------
// flowmeter
var flowMeter = function(interval, option){
	this.interval = isNum(interval) || 5000;
	option = option || {};
	var self = this;
	Stream.Transform.call(this, option);
	
  // check data flow rate
  this._flow = 0;
  this._flowAve = 0;
  this._start = 0;

  this.once("data", function(){
  	self._start = new Date();
  });

  this.once("result", function(rs){
  	console.log("[Flow]",rs);
  });
}
util.inherits(flowMeter, Stream.Transform);

// 最後の処理
flowMeter.prototype._flush = function(callback) {
	var end = new Date();
	// callback();
	this.emit("result", {
		total: this._flow,
		start: this._start,
		end:end,
		rangemilliSec : (end - this._start),
		rateMBytes : Math.round(this._flow /(end - this._start))/1000
		, memory : process.memoryUsage()
	});

	this._transform(new Buffer(0), '', callback);
}

// write関数 = 先のパイプから書き込まれる場所
flowMeter.prototype._transform = function(data, state, cb){
  var df = data.toString();
  if(this.objectMode){
  	this._flow += JSON.stringify(data).toString().length;	
  }else{
  	this._flow += data.toString().length;	
  }
	this.push(data);
  cb();
}


StreamSample.flowMeter = flowMeter;


// -------
function insertDummy(testParam, option){
	option = option || {}
	this.setTestParam(testParam);
	// option.objectMode = true;
	Stream.Readable.call(this, option);
}
util.inherits(insertDummy, Stream.Readable);

//create escape string
insertDummy.prototype.setTestParam = function(testParam){
	var tp = testParam || {};
	tp.rowCount = tp.rowCount || 1000;
	tp.columnCount = tp.columnCount || 1;
	tp.length = tp.length || 20;
	tp.multi = 100;

	var columns = [];
	for(var i=0; i < tp.columnCount; i++){
		columns.push("column_" + i);
	}

	var tablename ='`test`.`demo_table`'
	// init
	this.sqlstr = {};
	this.sqlstr.columns = columns;
	this.sqlstr.createTable = "CREATE TABLE IF NOT EXISTS " + tablename + " (id int not null,"
		 + columns.map(function(d){
		 	return '`' + d + '` VARCHAR(' + tp.length + ')';
		 }).join(",") + ", primary key(id));"
	this.sqlstr.insert = "INSERT INTO " + tablename + " SET ? ;"
	this.sqlstr.multiInsert = "INSERT INTO " + tablename + " (id, "+ columns.join(",") + ") VALUES"
	this.sqlstr.select = "SELECT * from " + tablename + ";";
	this.sqlstr.selectCount = "SELECT count(*) as 'count' from " + tablename + ";";
	this.sqlstr.dropTable = 'DROP TABLE IF EXISTS' + tablename;
	this.sqlstr.showColumns = 'SHOW COLUMNS from ' + tablename;

	// tp
	this._testParam = tp;
	this._index = 0;
}

insertDummy.prototype.getCreateTable = function(){
	return this.sqlstr.createTable;
}
insertDummy.prototype.getDropTable = function(){
	return this.sqlstr.dropTable;
}
insertDummy.prototype.getSelectCount = function(){
	return this.sqlstr.selectCount;
}

insertDummy.prototype._read = function(){
	var self = this;
	if(this._index >= this._testParam.rowCount){
		return this.push(null);
	}

	// var val = this.sqlstr.columns.reduce(function (prev, curr){
	// 	prev[curr] = randchar(self._testParam.length);
	// 	return prev;
	// },{});
	// val.id = this._index;


	// insert
	var val = [];
	val.push(this._index);
	this.sqlstr.columns.forEach(function(d){
		val.push(randchar(self._testParam.length));
	})

	++this._index;
	// console.log({sql:this.sqlstr.insert, val:val})
	this.push(JSON.stringify({sql:this.sqlstr.multiInsert, val:val}));
}

StreamSample.insertDummy = insertDummy;

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYG0123456789";
function randchar(len){
	var n = chars.length;
	var str ='';
	for (var i=0;i<len;i++){
		str += chars.charAt(Math.floor(Math.random()* n));
	}
	return str;
}


// 圧縮による比較を行うストリームが必要?


//-----------------------------------------------------------------------
// file確認用の拡張Stream
// @param inisStatus は streamに渡しておきたい変数
// @param optionはストリームの初期オプション
// @param assertFunction chunk asserting
function AssertStream(initFunction, option, assertFunction, callback){
	var self = this;
	if(!isFunction(initFunction)){
		Object.keys(initFunction).forEach(function(d){
			self[d] = initFunction[d];
		})	
	}
	
	option = option || {};
	Stream.Transform.call(this,option);
	this._asserts = assertFunction;
	
	this.on('finish', function(){
		callback(self);
	})

	if(isFunction(initFunction)){
		initFunction(this);
	}
}
util.inherits(AssertStream, Stream.Transform);

AssertStream.prototype._transform = function (chunk, state, cb) {
	// this.push(chunk);
	this._asserts(this, chunk, state, cb)
}

StreamSample.AssertStream = AssertStream;


function DummyWritable(initFunction, option, assertFunction, callback){
	var self = this;
	if(!isFunction(initFunction)){
		Object.keys(initFunction).forEach(function(d){
			self[d] = initFunction[d];
		})	
	}
	
	option = option || {};
	Stream.Writable.call(this,option);
	this._asserts = assertFunction;

	if(isFunction(initFunction)){
		initFunction(this);
	}
	
	this.on('finish', function(){
		callback(self);
	})
}
util.inherits(DummyWritable, Stream.Writable);

DummyWritable.prototype._write = function (chunk, enc, cb) {
	// this.push(chunk);
	this._asserts(this, chunk, enc, cb)
}
StreamSample.DummyWritable = DummyWritable;


// ---------------------------------------------------
// test data generator

function SignalGenerator(){
	Stream.Readable.call(this);
	// interval = isNum(interval) ? interval : undefined;
	// this.interval = interval || 100; // interval
	// this.limit = isNum(limit) ? limit : 20 * 1000;
	this._index = 0;
	this._iLimit = 100;

	this._plugin = [];
	this._plugin.push(["sin20", g_sin(50,20,0)]);
	this._plugin.push(["sin40", g_sin(50,40,0)]);
	this._plugin.push(["inpulse7", g_inpulse(7,40)]);
	this._plugin.push(["noise", g_noise(40)]);
}
util.inherits(SignalGenerator, Stream.Readable);

// 発信開始
SignalGenerator.prototype._read = function(){
	if(this._index >= this._iLimit){
		return this.push(null);
	}
	var data = gendata(this, this._index);
	this.push(JSON.stringify(data), 'utf8')
	this._index++;
}
StreamSample.SignalGen = SignalGenerator;

function gendata(gs, i){
	var key = {
		ID:i,
		EndDate: new Date()
	}
	var rate = 50;

	var data = gs._plugin.reduce(function(a, b){
		a[b[0]] = b[1](i);
		return a;
	},{})

	return {
		key:key,
		data:data
	}
}

// sine generate
function g_sin(rate, vpp, base){
	rate = rate || 100;
	vpp = vpp || 1;
	base = base || 0;
	return function(i){
		var r = 360 / rate;
		var v = vpp/2;
		var b = base;
		return Math.sin(i * r * (Math.PI/180)) * v + b;
	}
}

// inpulse
function g_inpulse(sleep, peek){
	sleep = sleep || 70;
	return function(i){
		if(i % sleep) return 0;
		return peek;
	}
}

function g_noise(range){
	return function(i){
		var x = Math.random();
		var y = Math.random();
		return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y)
	}
}