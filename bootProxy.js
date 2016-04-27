var Proxy = require(__dirname + "/index.js");
if (process.env.HTTP_PROXY || process.env.http_proxy) {
	var parentProxy = process.env.HTTP_PROXY || process.env.http_proxy;
}
Proxy.listen(process.env.PORT || 8080, process.env.IP || "127.0.0.1", parentProxy, function() {
	console.log("local proxy server start");
}, function(error, message, url) {
	console.log("error ,%s, %s, %s", error, message, url);
});