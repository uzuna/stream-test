'use strict';


//
// Generate iterator
//
module.exports.range = range
function range(start, end, step=1){
	return function*(){
		if(start > end){
			for(let i = start; i>=end ;i += step){
				yield i
			}
		}
		else{
			for(let i = start; i<=end ;i += step){
				yield i
			}
		}
	}
}

module.exports.range_random = range_random
function range_random(start, end){
	return function*(){
		for(let i = start; i<=end ;i++){
			yield {priority: Math.floor(Math.random() * 10), value:i}
		}
	}
}

module.exports.sleep = sleep
function * sleep(time){
	return new Promise((res)=>{
		setTimeout(res,time)
	})
}