const fs = require('fs');
const net = require("net");
const winston = require('winston');
const cu = require('cuckaroo-hashing');

const logger = new (winston.Logger)({
	transports: [
		new winston.transports.Console({timestamp:(new Date()).toLocaleTimeString(),colorize:true,level:'debug'}),
		new winston.transports.File({name:'a',json:false,filename:'logfile.txt',timestamp:(new Date()).toLocaleTimeString(),level:'info'}),
	]
});

process.on("uncaughtException", function(error) {
	logger.error(error);
});

var config = JSON.parse(fs.readFileSync('config.json'));
const localport = config.workerport;

var server = net.createServer(function (localsocket) {

	var remotesocket = new net.Socket();

	remotesocket.connect(3333,'stratum.MWGrinPool.com');

	localsocket.on('connect', function (data) {
	});

	var pre_pow = "";

	localsocket.on('data', function (data) {

		logger.debug("m->p "+data);
		
		var request = JSON.parse(data);
	
		if(request && request.method && request.method == "submit")
		{
			
			var header = cu.addnoncetoheader(new Buffer.from(pre_pow, 'hex'),request.params.nonce);

			var hash = cu.cuckaroo(header,request.params.pow);

			if(hash) logger.info('got valid share with diff: '+cu.getdifficultyfromhash(hash));
			
		}

		var flushed = remotesocket.write(data);
		if (!flushed) {
			console.log("  remote not flushed; pausing local");
			localsocket.pause();
		}
	});

	remotesocket.on('data', function(data) {

		data = data.toString().split("\n")[0];

		var request = JSON.parse(data);

		if(request && request.method && request.method == "getjobtemplate")
		{
			pre_pow = request.result.pre_pow;
			data=JSON.stringify(request);
		}
		else if(request && request.method && request.method == "job")
		{
			pre_pow = request.params.pre_pow;
			data=JSON.stringify(request);
		}
		
		logger.debug("p->m "+data);

		var flushed = localsocket.write(data.trim()+"\n");
		if (!flushed) {
			console.log("  local not flushed; pausing remote");
			remotesocket.pause();
		}
	});
	
	localsocket.on('drain', function() {
		remotesocket.resume();
	});

	remotesocket.on('drain', function() {
		localsocket.resume();
	});

	localsocket.on('close', function(had_error) {
		remotesocket.end();
	});

	remotesocket.on('close', function(had_error) {
		localsocket.end();
	});

});

server.listen(localport);

logger.info("start cuckaroo29 mining proxy on port %d ", localport);

