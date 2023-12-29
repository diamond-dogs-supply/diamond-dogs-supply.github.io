var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use('/css', express.static(__dirname + '/css'))
app.use('/js', express.static(__dirname + '/js'))
app.use('/images', express.static(__dirname + '/images'))


var server = app.listen(8080, function () {
    console.log('Node server is running... \n http://localhost:8080');
});
