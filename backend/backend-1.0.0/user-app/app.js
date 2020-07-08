const express = require('express')
const sleep = require('sleep')

const app = express()

app.get('/', (req, res) => {
  sleep.msleep(100)
  res.send('v1.0.0 thinks for 100 miliseconds!!');
});

app.listen(3000, '0.0.0.0')

