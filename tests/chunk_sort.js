'use strict';

const aa = require('aa')
const au = require('aa-util')
const stream = require('stream')
// const BufferList = require('internal/streams/BufferList')
console.log(require)

describe("chunk sort", function(){
	it('in readable', function(){
		return aa(main())
		function *main(){
			const src = au.stream.a2s([0,1,2,3,4,5,6,7,8,9])
			const corked = get_corked({objectMode: true, highWaterMark:8})
			const latest = au.stream.pipe([src, corked]);

			src.on("data",()=>{
				console.log(src._readableState.buffer)
				console.log(corked._readableState.buffer)
			})
			const rows = yield au.stream.reduce(latest);
			console.log(rows)
			yield sleep(500)
		}
	})
	it.skip('in readable', function(){
		return aa(main())
		function *main(){
			const g = range(0,10)
			const src = au.stream.g2s(g())
			const corked = get_corked({objectMode: true, highWaterMark:2})
			const latest = au.stream.pipe([src, corked]);

			console.log(src._readableState)
			const rows = yield au.stream.reduce(latest);
			console.log(rows)
		}
	})
})

//
// Generate iterator
//
function range(start, end){
	return function*(){
		for(let i = start; i<=end ;i++){
			yield i
		}
	}
}


//
// Corked Pipe
//
function get_corked(opt){
	let ts = stream.PassThrough(opt)
	ts.cork()
	return ts;
}

function sleep(time){
	return new Promise((res)=>{
		setTimeout(res, time)
	})
}