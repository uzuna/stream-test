'use strict';

const aa = require('aa')
const au = require('aa-util')
const stream = require('stream')

const BufferList = require('../lib/buffer_list')
const BufferQueueList = require('../lib/buffer_queue_list')
const expect = require('chai').expect

describe("priority buffer list", function(){
	//
	// Customized Readable stream out buffer list
	//
	it('buffer queue list', function(){
		return aa(main())
		function *main(){
			const que = new BufferQueueList()
			expect(que.head).to.be.null
			expect(que.tail).to.be.null

			let g = range_random(0,10)
			const src = au.stream.g2s(g())
			const rows = yield au.stream.reduce(src);
			for(let i of rows){
				que.push(i)
			}
			
			// Check insert chekcc by proprity
			que.push({priority:5, value: "X"})
			que.push({priority:4, value: "Y"})
			que.push({priority:7, value: "Z"})
			for(let i of rows){
				que.push({value: i})
			}

			// Check priority
			let current_proority = 0
			while(true){
				let rs = que.shift()
				if(rs === undefined) return 
				expect(rs.priority).to.be.gte(current_proority)
				current_proority = rs.priority
			}
		}
	})

	//
	//
	//
	it('built in stream', function(){
		return aa(main())
		function *main(){
			let g = range_random(0,10)
			const src = au.stream.g2s(g())
			const corked = get_corked({objectMode:true, highWaterMark:1})
			src._readableState.buffer = new BufferQueueList()
			// for debug origin
			// src._readableState.buffer = new BufferList()
			expect(src._readableState.buffer).to.be.an.instanceof(BufferQueueList)

			const latest = au.stream.pipe([src, corked]);
			
			// wait output to src buffer
			setTimeout(()=>{
				corked.uncork()
			},10)

			const rows = yield au.stream.reduce(latest);
			expect(rows).to.have.length.gte(10)
			
			// remove first packet(not sort target)
			rows.shift()
			rows.reduce((a, b)=>{
				expect(a.priority).to.be.lte(b.priority)
				return b;
			})
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

function range_random(start, end){
	return function*(){
		for(let i = start; i<=end ;i++){
			yield {priority: Math.floor(Math.random() * 10), value:i}
		}
	}
}

function get_corked(opt){
	let ts = stream.PassThrough(opt)
	ts.cork()
	return ts;
}

