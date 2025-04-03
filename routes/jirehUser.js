const express = require('express');
require('dotenv').config();
const router = express.Router();
const UserControllers = require('../controllers/jirehUserControllers')
const { userRegister } = require('../middlewares/registerUser');
const { isAuthenticated } = require('../middlewares/auth');

router.post('/register', [userRegister], UserControllers.register)

router.post('/login', UserControllers.login)

router.post('/forgot-password', UserControllers.forgotPassword)

router.post('/reset-password/:id', UserControllers.resetPassword)

//////////////////////////////////////////////////SHOES///////////////////////////////////////////////

router.get('/get_products', UserControllers.get_products)






module.exports = router