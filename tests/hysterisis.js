'use strict';

const aa = require('aa')
const au = require('aa-util');
const Transform = require('stream').Transform

const spt = require('./supports')

describe('hysterisis', ()=>{
	it('liner', function(){
		return aa(main())
		function *main(){
			const g = spt.range(0,50);
			const proc = linemap()
			const dest = Transform({objectMode: true, transform:function(chunk, enc, cb){
				console.log(chunk, proc(chunk))
				cb()
			}})

			const src = au.stream.g2s(g())
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
		}
	})
})

//
// liner
//
function linemap(opt){
	opt = opt || {}
	let map = opt.map || {src:[0, 50], th:[1,4]}
	const slope = (map.th[1]-map.th[0]) / (map.src[1] - map.src[0])
	return (x)=>{
		return Math.ceil(x * slope)
	}
}