const express = require('express')
const sleep = require('sleep')

const app = express()

app.get('/', (req, res) => {
  sleep.msleep(300)
  res.send('v1.0.1 thinks for 300 miliseconds!!');
});

app.listen(3000, '0.0.0.0')

