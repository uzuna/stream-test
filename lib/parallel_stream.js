'use strict';

const aa = require('aa');
const stream = require('stream');

const CheckProperty = ["max", "run"]
//
// Parallel 1 -(x)-> 1
// @param run(stream._write, data) job Promise
// @param max max parallec count
//
module.exports.parallel = function createParallel(opt){
	return new ParallelStream(opt)
}

class ParallelStream extends stream.Transform{
	constructor(opt){
		for(let v of CheckProperty){
			if(!(v in opt))
				throw TypeError(`Need "${v}" parameter for Parallel Stream`)
		}
		super(opt)
		this._cache = [];
		this._max = opt.max
		this._counter = 0
		this._endcb = null
		this._run = opt.run;
		const self = this
		const transform_generate = function (chunk, enc, cb){
			aa(function *(){
				self._precb(cb);
				yield self._run(chunk, enc)
				self._postcb();
			})
			.catch((err)=>{
				self._postcb();
			})
		}

		const transform_callback = (chunk, enc, cb)=>{
			this._precb(cb);
			this._run(chunk, enc, ()=>{
				this._postcb();
			})
		}

		if(/GeneratorFunction/i.test(opt.run.constructor.name)){
			this._transform = transform_generate
		}
		else{
			this._transform = transform_callback
		}
	}
	
	_precb(cb){
		++this._counter
		if(this._counter >= this._max){
			this._cache.push(cb);
			return false;
		}
		cb()
	}
	_postcb(){
		--this._counter
		if(this._counter < this._max && this._cache.length > 0){
			this._cache.shift()();
		}
		else if(this._endcb && this._counter < 1){
			this._endcb()
		}
	}
	_flush(cb){
		this._endcb = cb;
		this._postcb();
	}
	setmax(n){
		if(isNaN(n)) return false;
		return this._max = n
	}
}


//
// branch 1->n
//
module.exports.branch = function createBranchStream(opt){
	return new BranchStream(opt)
}
class BranchStream extends stream.Writable{
	constructor(opt){
		super(opt);
		this._writable = [];
		this._weight = opt.weight || [];
		this._counter = 0;
		this._active_dest = []
		this._current_point = 0;
		this._onfinish = false;
		this.on('finish',()=>{
			this._onfinish = true;
			for(let vt of this._writable){
				vt.end();
			}
		})
	}
	_write(chunk, enc, cb){
		const did = this._active_dest.shift();
		const target = this._writable[did];
		const pipeopen = target.write(chunk);
		if(pipeopen){
			this._active_dest.push(did)
			return cb();
		}
		else{
			if(this._active_dest.length > 0){
				target.once("drain",()=>{
					this._active_dest.push(did)
				})
				return cb();
			}
			target.once("drain",()=>{
				this._active_dest.push(did)
				return cb()
			})
		}
	}
	pipe(obj){
		this._writable.push(obj);
		this._active_dest.push(this._writable.length - 1)
		return obj
	}
	unpipe(){
		this._writable = null	
	}
}

//
// Junction n->1
//
module.exports.junction = function createJunctionStream(opt){
	return new JunctionStream(opt)
}
class JunctionStream extends stream.Transform{
	constructor(opt){
		super(opt)
		this.preclose = false;
		this._current_openpipe = 0;
		this.on('pipe',()=>{
			++this._current_openpipe;
		})
	}
	_transform(chunk, enc, cb){
		this.push(chunk)
		cb();
	}
	end(){
		--this._current_openpipe
		if(this._current_openpipe < 1){
			super.end();
		}
	}
}