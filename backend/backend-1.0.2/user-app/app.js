const express = require('express')
const sleep = require('sleep')

const app = express()

app.get('/', (req, res) => {
  sleep.msleep(50)
  res.send('v1.0.2 thinks for 50 miliseconds!!');
});

app.listen(3000, '0.0.0.0')

