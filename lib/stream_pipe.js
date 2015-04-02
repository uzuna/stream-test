const util = require('util');
const fs = require('fs');
const path = require('path');
const Stream = require('stream');
const iconv = require('iconv-lite');


// 外部公開
module.exports = StreamPipe;
function StreamPipe(){}


// --util------------------------------------------------
function isNum(v){
	if(typeof(v) === 'number') return true;
	return false;
}

function isFunction(arg) {
	return typeof arg === 'function';
}

function isString(c){
	return typeof c === "string"
}

const number_regexp = /^[1-9]\d*(?!\.)\d+|^[1-9]\d*$|^0$|0\.\d+$/;

// ----------------------------------------------------------------------
// linestream 読み込んだデータを改行コードで切ってchunk
// option.encode = encoding string use iconv-lite
// option.lf = set linefeed char [auto]
var lineStream = function (option){
	option = option || {};
	Stream.Transform.call(this);
	this._cache = "";
	this._encoding = option.encode || "utf8";
	this.lf = option.lf || "auto";
}
util.inherits(lineStream, Stream.Transform);

// resetnewLinechar
lineStream.prototype.setLineChar = function(char){
	if(isString(char)){
		this.lf = new RegExp(char);
		return true;
	}else if(util.isRegExp(char)){
		this.lf = char;
		return true;
	}
	return false;
}

// get linechar
lineStream.prototype.getLineChar = function(char){
	return this.lf;
}

// 終端処理
lineStream.prototype._flush = function (callback) {
	this.push(this._cache);
	this.push(null);
}

//　改行コードでsplitして次に渡す
lineStream.prototype._transform = function (chunk, state, cb) {
	var self = this;
	chunk = iconv.decode(chunk,this._encoding);

	// auto line feed
	if(this.lf === "auto"){
		if(/\r\n/.exec(chunk)) this.lf = /\r\n/;
		else if(/\n/.exec(chunk)) this.lf = /\n/;
		else {
			this._cache = this._cache + chunk;
			return cb();
		}
	}
	chunk = this._cache + chunk;

	if(this.lf.test(chunk)){
		var list = chunk.split(this.lf);
		this._cache = list.pop();
		list.forEach(function (d) {
			self.push(iconv.encode(d, self._encoding));
		});
	}else{
		this._cache = chunk;
	}
  cb();
}
StreamPipe.lineStream = lineStream;


// ----------------------------------------------------------------------
// CSVの読み込みLine単位に分解 + レコードレベルに分解する	
// headerとoutput条件
// csv parserはこれを参考に https://github.com/voodootikigod/node-csv/blob/master/index.js
// 
var CsvStream = function (outputFormat, option){
	if(!(outputFormat instanceof Array) && arguments.length === 1){
		option = outputFormat;
		outputFormat = [];
	}
	option = option || {}
	this._toJSON = option.toJSON || false;

	if(!this._toJSON)
		option.objectMode = true;								// これにつなぐpipeも設定が必要
	Stream.Transform.call(this, option);
	this._rename = option.rename || [];				// Array of {name, match:RegExp}
	this._encoding = option.encode || 'utf8';				// Array of {name, match:RegExp}
	this._outputformat = outputFormat || [];	// output name:{type, function}
	this._remap = function(d){return d;}			// convert input Array to Obj
	this._convert = function(d){return d;}		// convert output Obj to formatted Obj

	option.header = option.header || [];			// Array
	this._onHeader = false;										// headerの有無。 なければoutputしない
	if (option.header.length > 1) this.setHeader(option.header)

	// default input format
	this._csvformat = option.csvFormat || {
		delimiters: ","
	};

	// output の検出Validation
	this._validation = {
		header : option.validHeader || ""
	}

	// ｃｓｖparserなどは事前に関数に直す
	this.setCsvDecode()		// inputのDecoderをcompile
	this.setObjEncode()		// OutPut前のEncoderをCompile
}
util.inherits(CsvStream, Stream.Transform);

// csvのヘッダーを作成する
// Array position->name 変換
CsvStream.prototype.setHeader = function (data) {
	// headerValidation
	
	if(this._validation.header.length >0){
		if(!data.match(this._validation.header)){
			return false;
		}
	}

	data = this._parser(data)

	// 関数作成
	rename = this._rename;
	data = data.map(function (d) {
		for (i in rename){
			v = rename[i]
			if(isString(v.match)) v.match = new RegExp(v.match);
			if (v.match.exec(d)) {
				return d.replace(v.match, v.name);
			}
		}
		return d;
	});

	// uniqueを確認 @todo

	// 位置をkeyに、名前をvalueに変換
	data = data.reduce(function (prev, curr, i){
		if(i in prev) return prev;
		prev[i] = curr;
		return prev;
	},{});

	// 行データを渡すとobjectにして戻す関数をset
	this._remap = function(line){
		return line.reduce(function (prev, curr, i){
			prev[data[i]] = curr;
			return prev;
		},{});
	}

	// header有
	this._onHeader = true
	return true;
}

// converter
CsvStream.prototype.setObjEncode = function(format){
	format = format || this._outputformat;
	// 指定が無い場合はすべてを
	if(format.length < 1){
		this._convert = function(d){return d;};
		return true;
	}

	// 条件連想を関数に変換する
	format = compile_outputConvert(format);

	// convert関数を作成して保持する
	var convert = function(data){
		return format.reduce(function (prev, curr){
			var prev = loopDecode(prev, curr, data);
			return prev;
		},{})
		// convert条件を実データの直す
		function loopDecode(prev, curr, data){
			var n = curr.name
			if("modify" in curr){
				var md = curr.modify(data)
				if(md !== null){
					prev[n] = md
				}
			}else{
				if(n in data)
					prev[n] = data[n];
			}
			return prev
		}
	}

	this._convert = convert;
	return true;

	// formatを事前にfunction形式にコンパイルする
	function compile_outputConvert(format){
		format = format || this._outputformat;
		format = format.map(function(d){
			return formatDecode(d);
		});
		return format;
	}

	// 再帰的に関数に変換する joinがある為
	function formatDecode(d){
		if("join" in d){			
			if(!(d.join instanceof Array)) return d;
			cbl = d.join.map(formatDecode);
			var separater = d.separater || "";
			d.modify = function(v){
				list = cbl.map(function (x){
					if("modify" in x)
						return x.modify(v);
					return ""
				})
				return list.join(separater);
			}
		}else if("slice" in d && "item" in d){
			d.modify = function(v){
				v = v[d.item]
				return String.prototype.slice.apply(v, d.slice);
			}
		}else if("replace" in d && "item" in d){
			if(!(d.replace instanceof Array)) return d;
			if(d.replace[0] instanceof Array){
				d.replace[0] = new RegExp(d.replace[0][0], d.replace[0][1])
			}
			d.modify = function(v){
				v = v[d.item]
				return String.prototype.replace.apply(v, d.replace);
			}
		}else if("name" in d && "remove" in d){
			d.modify = function(v){
				if(!d.remove){
					return v[d.name];
				}
				return null;
			}
		}
		else if("name" in d){
			d.modify = function(v){
				if(d.name in v){
					return v[d.name];
				}
				return null;
			}
		}
		return d;
	}
}


// @function
// パース用関数の作成
CsvStream.prototype.setCsvDecode = function (format) {
	format = format || this._csvformat;
	if("delimiters" in format){
		var parser = function(d){
			return d.split(format.delimiters)
		}
	}else{
		throw new TypeError("not found delimeter in csvformat parameter");
	}
	this._parser = parser;
	return true
}

// @private
CsvStream.prototype._transform = function (chunk, state, cb){
	// Headerが未設定の場合はヘッダーを検出するまで無視する
	// chunk = chunk.toString()
	chunk = iconv.decode(chunk, this._encoding);
	if(!this._onHeader) {
		this.setHeader(chunk)
		return cb();
	}
	var data = this._parser(chunk)
	
	// dataのバリデーション @todo ?
	
	// dataのobject化
	data = this._remap(data);

	// dataのformat適用
	data = this._convert(data);

	//if json mode
	if(this._toJSON)
		data = JSON.stringify(data)
	
	// console.log(data)
	this.push(data);
	cb()
}

StreamPipe.CsvStream = CsvStream;


// ----------------------------------------------------------------------
// Obj読み込みをしてKVCubeに変換する
// KVCube : primarykey arrayとそれ以外のJSONからなる中間保存形式に変換する
// 
function CubeStream (formatOption, option){
	option = option || {};

	Stream.Transform.call(this, option);
	this._format = formatValidation(formatOption);

	function formatValidation(option){
		if(!("key" in option)) throw new TypeError('not found "key" in cubeOption');

		option.null = option.null || false;
		return option;
	}
}
util.inherits(CubeStream, Stream.Transform);

// @private
// parse function
CubeStream.prototype._parse = function(chunk){
	var i = 0;
	key = this._format.key.reduce(function (prev, d){
		if(d in chunk){
			prev[d] = chunk[d];
			delete chunk[d];
			++i;
		}
		return prev;
	},{})

	if(i === this._format.key.length){
		// delete null column
		if(true){
			for(var d in chunk){
				if(chunk[d].length < 1) {
					delete chunk[d];
					continue;
				}
				var n = Number(chunk[d]);
				if(!isNaN(n)){
					if(number_regexp.test(d)) chunk[d] = n
				}
			}
		}

		var data = {
			key: key,
			data: chunk
		}
		return data;
	}
	return null;
}


// @private
CubeStream.prototype._transform = function (chunk, state, cb){
	chunk = JSON.parse(chunk.toString("utf8"));

	// parse
	var data = this._parse(chunk)
	if(data !== null) this.push(JSON.stringify(data));

	cb()
}

StreamPipe.CubeStream = CubeStream;


// ----------------------------------------------------------------------
// filter listner like stream protocol
// 
function filterStack(filter, callback){
	var self = this;
	this._stack = [];
	this.filter = filter;
	this.
	Stream.Transform.call(this, option);

	this.on('finish', function (){
		callback(null, self._stack)
	})
}

util.inherits(filterStack, Stream.Transform);

filterStack.prototype._transform = function (chunk, state, cb) {
	if(this.filter.exec(chunk)){
		this._stack.push(chunk);
	};
	cb()
}


// ----------------------------------------------------------------------
// CubeStoreから読み出したデータをCubeにする
// KVCube : primarykey arrayとそれ以外のJSONからなる中間保存形式に変換する
// 
function EndPointStream (option){
	option = option || {};
	option.objectMode = true;

	Stream.Transform.call(this, option);
}
util.inherits(EndPointStream, Stream.Transform);

// @private
EndPointStream.prototype._transform = function (chunk, state, cb){
	// chunk = JSON.parse(chunk.toString("utf8"));
	// parse
	var data = EPtoCube(chunk)
	if(data !== null) this.push(JSON.stringify(data));
	cb()
}
StreamPipe.EndPointStream = EndPointStream;


function EPtoCube(chunk){
	var val = JSON.parse(chunk.data);
	delete chunk.data;
	return {
		key:chunk,
		data:val
	}
}

// ----------------------------------------------------------------------
// CubeStreamにフィルターを掛ける row col両方
function CubeFilter(option){
	option = option || {};
	Stream.Transform.call(this, option);
	util.inherits(this, Stream.Transform);

	var col = {
		match:[],
		ignore:[]
	}

	this._filter = {
		col:col,
		row:function(d){return true;}
	}
	this._filterlength = {match:0, ignore:0};
}
util.inherits(CubeFilter, Stream.Transform);

CubeFilter.prototype.getFilter = function(option){
	
}

CubeFilter.prototype.setRowFilter = function(func){
	this._filter.row = func;
}

// 
CubeFilter.prototype.addColumnFilter = function(pattern, value){
	var pat = "";
	// @todo value validation
	if(/like|^lk$/.test(pattern)){
		value = new RegExp(value, "i");
		pat = "match";
	}else if(/^eq$|equal/.test(pattern)){
		value = new RegExp("^"+value+"$");
		pat = "match";
	}else if(/^not$/.test(pattern)){
		value = new RegExp("^"+value+"$");
		pat = "ignore";
	}else if(/^nl$|notlike/.test(pattern)){
		value = new RegExp(value, "i");
		pat = "ignore";
	}else{
		return false
	}
	this._filter.col[pat].push(value);
	return ++this._filterlength[pat];
}

// 
CubeFilter.prototype.removeColumnFilter = function(pattern, value){
	var pat = "";
	if(/like|^lk$|^eq$|equal/.test(pattern)) pat = "match";
	else if(/^not$|^nl$|notlike/.test(pattern)) pat = "ignore";
	else return false;

	this._filter.col[pat] = this._filter.col[pat].filter(function(d){
		return !d.test(value);
	});
	this._filterlength[pat] = this._filter.col[pat].length
	return this._filterlength[pat];
}


CubeFilter.prototype.addRowFilter = function(item, op, val){
	this._filter.col[i] = this._filter.col[i] || {}
	var flt = this._filter.col[i];

}

CubeFilter.prototype.removeRowFilter = function(option){

}


CubeFilter.prototype._transform = function(chunk, state, cb){
	var self = this;
	chunk = JSON.parse(chunk);
	var data = chunk.data;

	// column
	var data = Object.keys(data).reduce(function (prev, curr) {
		for(var i=0; i<self._filterlength.ignore; i++){
			if(self._filter.col.ignore[i].exec(curr)) return prev;
		}

		if(self._filterlength.match < 1) {
			if(data[curr] === "") return prev;	// cut null data

			// 数値変換 cube化の前にされるはずなのだが...
			var d = data[curr]
			var n = Number(d);
			if(!isNaN(n)){
				// if(number_regexp.test(d)) d = n
				d = n
			} 

			prev[curr] = d;
			return prev;
		}
		for(var i=0; i<self._filterlength.match; i++){
			if(self._filter.col.match[i].exec(curr)) {
				prev[curr] = data[curr];

				// 数値変換 cube化の前にされるはずなのだが...
				var d = data[curr]
				var n = Number(d);
				if(!isNaN(n)){
					if(number_regexp.test(d)) d = n
				} 
				prev[curr] = d;
				return prev;
			}
		}
		return prev
	},{});

	if(!this._filter.row(data)){
		return cb();
	}

	chunk.data = data;
	chunk = JSON.stringify(chunk)
	this.push(chunk);
	cb();
}

StreamPipe.CubeFilter = CubeFilter;

function validFilter(flt){
	return flt;
}


// ----------------------------------------------------------------------
// Assert
function AssertStream(initStatus, assertFunction, callback){
	var self = this;
	Object.keys(initStatus).forEach(function(d){
		self[d] = initStatus[d];
	})
	option = {};
	option.objectMode = true;
	Stream.Transform.call(this, option);
	this._asserts = assertFunction;

	this.on('finish', function(){
		console.log("finish")
		callback(self);
	})
}
util.inherits(AssertStream, Stream.Transform);

AssertStream.prototype._transform = function (chunk, state, cb) {
	if(!option.objectMode) chunk = chunk.toString();
	this._asserts(this, chunk, state, cb)
}

StreamPipe.AssertStream = AssertStream;