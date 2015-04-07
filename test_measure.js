const cluster = require('cluster');
var measure = require('./test_time');

if(cluster.isMaster) {

	var genCounter = 0
	var tasks = [];
	var result = [];
	var loop = 10
	tasks.push(["onmemory",1,loop])
	tasks.push(["stream_addpass",10,loop])
	tasks.push(["stream_addpass",100,loop])
	tasks.push(["stream_multi",1,loop])

	// cluster.fork();
	cluster.on('exit', function(worker, code, signal){
		// console.log('kill worker #' + worker.id, worker.suicide);
		var rs = generateWorker(cluster,tasks);
		if(!rs) {
			console.log(result);
			process.exit(1);
		}
	})
	cluster.on('online', function (worker){
		worker.on("message", function(msg){
			console.log(worker.id, msg);
			result.push(msg)
		})
	});

	generateWorker(cluster,tasks);

}else{
	process.once("message", function(msg){
		console.log("[Start]",msg)
		measure(msg[0],msg[1],msg[2],function(err, result){
			process.send(result);
			process.exit(0);
		});
		// console.log(msg);
		// process.exit(0);
	});
}

//
function generateWorker(cluster, task){
	if(task.length < 1) return false;
	var job = task.shift();
	cluster.once("online", function (worker){
		worker.send(job)
	})
	cluster.fork();
	return true;
}