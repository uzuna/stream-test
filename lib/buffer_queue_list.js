'use strict';


//
// Buffer Query
//
class BufferQueueList{
	constructor(){
		this._stack = []
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

	unshift(v){
		this.push(v)
	}

	shift(){
		const ret = this._stack.shift()
		// console.log("[BLQ:ret]",ret)
		return ret
	}

	clear(){
		this._stack = []
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


module.exports = BufferQueueList