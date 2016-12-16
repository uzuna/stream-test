'use strict';

const aa = require('aa')
const au = require('aa-util');
const Transform = require('stream').Transform

const spt = require('./supports')

describe('hysterisis', ()=>{
	it('liner', function(){
		return aa(main())
		function *main(){

			// upper
			const g = spt.range(1,60);
			const proc = linemap({src:[0, 60], th:[1,4]})
			const dest = Transform({objectMode: true, transform:function(chunk, enc, cb){
				// console.log(chunk, proc(chunk))
				this.push(proc(chunk))
				cb()
			}})

			const src = au.stream.g2s(g())
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
			const hist = row.reduce(histogram, {})
			console.log(hist)
		}
	})
	it('liner up', function(){
		return aa(main())
		function *main(){
			const g = spt.range(1,60);
			const proc = linemap_window({src:[0, 60], th:[1,4]})
			const dest = Transform({objectMode: true, transform:function(chunk, enc, cb){
				this.push(proc(chunk))
				cb()
			}})

			const src = au.stream.g2s(g())
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
			const hist = row.reduce(histogram, {})
			console.log(hist)
		}
	})

	it('liner down', function(){
		return aa(main())
		function *main(){
			const g = spt.range(60,1,-1);
			const proc = linemap_window({src:[0, 60], th:[1,4]})
			const dest = Transform({objectMode: true, transform:function(chunk, enc, cb){
				this.push(proc(chunk))
				cb()
			}})

			const src = au.stream.g2s(g())
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
			const hist = row.reduce(histogram, {})
			console.log(hist)
		}
	})
})

//
// liner
//
function linemap(opt){
	opt = opt || {}
	const map = opt.map || {src:[0, 60], th:[1,4]}
	const slope = (map.th[1]-map.th[0]) / (map.src[1] - map.src[0])
	return (x)=>{
		return Math.ceil(x * slope)
	}
}

//
// hysterisis
//
function linemap_window(opt){
	opt = opt || {}
	const map = opt.map || {src:[0, 50], th:[1,4]}
	const rate = opt.rate ||  0.6
	const active_map = Math.floor(map.src[1] * rate)
	const offset = {
		up: map.src[1] - active_map,
		down: active_map
	}
	const slope = (map.th[1] - map.th[0]) / (active_map - map.src[0])
	let current = map.th[0]
	let prev = map.src[0]
	return function(x){
		if(x === prev) return current
		else if(x >= map.src[1]) current = map.th[1]
		else if(x <= map.src[0]) current = map.th[0]

		// upper
		else if(x > prev){
			if(x <= offset.up) current = map.th[0]
			else current = Math.floor((x - offset.up) * slope) + map.th[0]
		}else{
			// down
			if(x >= offset.down) current = map.th[1]
			else current = Math.floor(map.th[1] - ((offset.down - x) * slope))
		}
		prev = x;
		return current
	}
}


function histogram(a, b){
	if(!(b in a)) a[b] = 0
	a[b]++
	return a;
}