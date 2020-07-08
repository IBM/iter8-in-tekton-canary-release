const express = require('express')
const app = express()

app.get('/', (req, res) => {
  const request = require('request');
  request('http://iter8-demo:3000/', { json: true }, (err, backres, body) => {
    if (err) {
      console.log(err);
      body = { "error": "an error occcured " }
    }
    res.send(body);
  });
});

app.listen(3000, '0.0.0.0')
