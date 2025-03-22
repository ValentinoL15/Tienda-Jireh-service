const express = require('express');
const app = express();
const userRoutesAdmin = require('./jirehAdmin');

app.use('/jireh', userRoutesAdmin);

module.exports = app;