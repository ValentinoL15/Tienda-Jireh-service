const express = require('express');
const app = express();
const RoutesAdmin = require('./jirehAdmin');
const RoutesUser = require('./jirehUser');

app.use('/jireh', RoutesAdmin);
app.use('/userJireh', RoutesAdmin);

module.exports = app;