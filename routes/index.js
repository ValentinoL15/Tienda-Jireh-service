const express = require('express');
const app = express();
const userRoutes = require('./jireh');

app.use('/jireh', userRoutes);

module.exports = app;