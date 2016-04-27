var SUCCESS_RESPONSE_MESSAGE = 'HTTP/1.0 200 Connection established\r\n\r\n';
module.exports = {
	listen : function(port, ip, parentProxy, onServerStart, onError) {
		var http = require('http');
		var url = require('url');
		var net = require('net');
		var proxyPort = port || 8080;
		if (parentProxy) {
			var parentProxyUrl = url.parse(parentProxy);
			var parentProxyHost = parentProxyUrl.hostname;
			var parentProxyPort = (parentProxyUrl.port || 80);
			var parentProxyAuth = parentProxyUrl.auth;
		}
		if (!onError) {
			onError = function() {
			}
		}
		var server = http.createServer(function(req, res) {
			var clientSocket = req.socket || req.connection;
			var requestUrl = url.parse(req.url);
			var requestToServer = http.request({
				host : parentProxyHost || requestUrl.hostname,
				port : parentProxyPort || requestUrl.port || 80,
				path : parentProxy ? req.url : requestUrl.path,
				method : req.method,
				headers : req.headers,
				agent : clientSocket.httpAgent
			}, function(serverResponse) {
				res.writeHead(serverResponse.statusCode, serverResponse.headers);
				serverResponse.pipe(res);
			});
			req.pipe(requestToServer);
			requestToServer.on('error', function(err) {
				res.writeHead(400, err.message, {
					'content-type' : 'text/html'
				});
				res.end('<h1>Error</h1><div>' + err.message + '</div><div>' + req.url + '</div>');
				onError(err, 'on server request', requestUrl.hostname + ':' + (requestUrl.port || 80));
			});
		}).listen(proxyPort, ip, onServerStart);
		server.on('connect', function(req, clientSocket, cliHead) {
			var serverSocket;
			var requestUrl = url.parse('https://' + req.url);
			var onSocketError = function(socket, message, url) {
				return function(err) {
					socket.end();
					onError(err, message, url);
				}
			}
			if (parentProxy) {
				if (parentProxyAuth) {
					req.headers["Proxy-Authorization"] = 'Basic ' + new Buffer(parentProxyAuth).toString('base64');
				}
				var requestToServer = http.request({
					host : parentProxyHost,
					port : parentProxyPort,
					path : req.url,
					method : req.method,
					headers : req.headers,
					agent : clientSocket.httpAgent
				});
				requestToServer.on('connect', function(svrRes, toProxySocket, svrHead) {
					serverSocket = toProxySocket;
					clientSocket.write(SUCCESS_RESPONSE_MESSAGE);
					if (cliHead && cliHead.length) {
						serverSocket.write(cliHead);
					}
					if (svrHead && svrHead.length) {
						clientSocket.write(svrHead);
					}
					serverSocket.pipe(clientSocket);
					clientSocket.pipe(serverSocket);
					serverSocket.on('error', onSocketError(clientSocket, 'on server socket', req.url));
				});
				requestToServer.on('error', onSocketError(clientSocket, 'on parent proxy', req.url));
			} else {
				serverSocket = net.connect(requestUrl.port || 443, requestUrl.hostname, function() {
					clientSocket.write(SUCCESS_RESPONSE_MESSAGE);
					if (cliHead && cliHead.length)
						serverSocket.write(cliHead);
					clientSocket.pipe(serverSocket);
				});
				serverSocket.pipe(clientSocket);
				serverSocket.on('error', onSocketError(clientSocket, 'on server connection', req.url));
			}
			clientSocket.on('error', function onCliSocErr(err) {
				if (serverSocket) {
					serverSocket.end();
				}
				onError(err, 'clientSocket', req.url);
			});
		});
		server.on('connection', function onConn(clientSocket) {
			clientSocket.httpAgent = new http.Agent({
				keepAlive : true
			});
			clientSocket.httpAgent.on('error', onError);
		});
		server.on('clientError', function(err, clientSocket) {
			clientSocket.end();
			onError(err, 'client error', '');
		});
	}
}