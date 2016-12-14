'use strict';

const aa = require('aa')
const au = require('aa-util')
const stream = require('stream')
const expect = require('chai').expect

describe("chunk sort", function(){
	it('in readable', function(){
		return aa(main())
		function *main(){
			const que = new BufferListQueue()
			expect(que.head).to.be.null
			expect(que.tail).to.be.null

			let g = range(0,10)
			const src = au.stream.g2s(g())
			const rows = yield au.stream.reduce(src);
			for(let i of rows){
				que.push({priority:i, value: i})
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
// Buffer Query
//
class BufferListQueue{
	constructor(){
		this._stack = []
		// this.head = null;
		// this.tail = null;
		// this.length = 0;
	}
	get head(){
		if(this._stack.length > 0)
			return this._stack[0]
		return null
	}
	get tail(){
		if(this._stack.length > 0)
			return this._stack[this._stack.length - 1] 
		return null
	}
	get length(){
		return this._stack.length;
	}

	push(v){
		if(!("priority" in v))
			v.priority = 5

		const priority = v.priority
		if(this.head === null){
			this._stack.push(v);
			return 
		}

		if(this.head.priority > priority){
			this._stack.unshift(v);
			return 
		}

		if(this.tail.priority <= priority){
			this._stack.push(v);
			return 
		}
		this._stack = search_loop(this._stack, v)
	}

	shift(){
		return this._stack.shift()
	}
}

function search_loop(list, v){
	const index = v.priority
	const length = list.length - 1;
	const th_seq = 2
	let range = {min: 0, max: length}
	let pos = length
	while(true){
		let rs = check(pos)
		// console.log(rs);
		if(rs[0]){
			return rs[1]
		}
		pos = rs[1]
	}

	function check(oldpos){
		if(list[oldpos].priority <= index){
			range.min = oldpos
			const diff = (range.max - oldpos) / 2
			const nindex = oldpos + diff
			const npos = Math.floor(nindex)
			if(diff < th_seq) {
				return [true, sequence(npos)]
			}
			return [false, npos]
		}
		if(list[oldpos].priority > index){
			range.max = oldpos
			const diff = (oldpos - range.min) / 2;
			const nindex = oldpos - diff
			const npos = Math.floor(nindex)
			if(diff < th_seq) {	
				return [true, sequence(npos)]
			}
			return [false, npos]
		}
		return 
	}

	function sequence(oldpos){
		while(true){
			if(list[oldpos].priority > index){
				list = list.slice(0, oldpos)
					.concat([v])
					.concat(list.slice(oldpos))
				return list
			}
			oldpos++
		}
	}
}