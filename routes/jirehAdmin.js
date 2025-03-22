const express = require('express');
require('dotenv').config();
const router = express.Router();
const AdminControllers = require('../controllers/jirehAdminControllers')

router.post('/register', AdminControllers.register)

router.post('/login', AdminControllers.login)

router.post('/forgot-password', AdminControllers.forgotPassword)

module.exports = router