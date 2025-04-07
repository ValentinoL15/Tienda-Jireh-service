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

router.get('/get_products',UserControllers.get_products)

router.get('/get_products_by_gender/:brand/:gender', UserControllers.get_products_by_gender);

router.get('/get_product/:id', UserControllers.get_product)

///////////////////////////////////////////////////PAYMENTS/////////////////////////////////////////

router.post('/create_payment/:id', UserControllers.create_payment);

router.post('/webhook', UserControllers.webhook)






module.exports = router