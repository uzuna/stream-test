'use strict';

const aa = require('aa')
const au = require('aa-util')
const stream = require('stream')
const spt = require('./supports')

const Parallel = require('../lib/parallel_stream')

const expect = require('chai').expect

describe('parallel', function(){
	it("transform function", function(){
		return aa(main())
		function *main(){
			const opt = {
				objectMode: true,
				max:2,
				run: function(chunk, enc, cb){
					// console.log(chunk)
					chunk = chunk * 2
					this.push(chunk)
					setTimeout(cb, 100)
				}
			}
			const src = au.stream.g2s(spt.range(0,10)())
			const dest = Parallel.parallel(opt)
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
			expect(row).to.be.a('array')
			row.forEach((d)=>{
				expect(d % 2).to.be.eq(0)
			})
			// console.log(row)
		}
	})

	it("transform generator",function(){
		return aa(main())
		function *main(){
			const opt = {
				objectMode: true,
				max:5,
				run: function*(chunk, enc){
					// console.log(chunk)
					yield spt.sleep(100)
					chunk = chunk * 2
					this.push(chunk)
				}
			}
			const src = au.stream.g2s(spt.range(0,10)())
			const dest = Parallel.parallel(opt)
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
			expect(row).to.be.a('array')
			row.forEach((d)=>{
				expect(d % 2).to.be.eq(0)
			})
			// console.log(row)
		}
	})

	it("short packet",function(){
		return aa(main())
		function *main(){
			const opt = {
				objectMode: true,
				max:10,
				run: function*(chunk, enc){
					// console.log(chunk)
					yield spt.sleep(100)
					chunk = chunk * 2
					this.push(chunk)
				}
			}
			const src = au.stream.g2s(spt.range(0,1)())
			const dest = Parallel.parallel(opt)
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
			expect(row).to.be.a('array')
			row.forEach((d)=>{
				expect(d % 2).to.be.eq(0)
			})
			// console.log(row)
		}
	})

	it("long packet",function(){
		return aa(main())
		function *main(){
			const opt = {
				objectMode: true,
				max:100,
				run: function*(chunk, enc){
					// console.log(chunk)
					yield spt.sleep(10)
					chunk = chunk * 2
					this.push(chunk)
				}
			}
			const src = au.stream.g2s(spt.range(0,500)())
			const dest = Parallel.parallel(opt)
			const latest = au.stream.pipe([src, dest])
			const row = yield au.stream.reduce(latest)
			expect(row).to.be.a('array')
			row.forEach((d)=>{
				expect(d % 2).to.be.eq(0)
			})
			// console.log(row)
		}
	})
})