const express = require('express');
require('dotenv').config();
const router = express.Router();
const AdminControllers = require('../controllers/jirehAdminControllers')
const { isAdmin } = require('../middlewares/isAdmin')
const multerStorage = require('../utils/multer');
const { isAuthenticated } = require('../middlewares/auth');

router.post('/register', AdminControllers.register)

router.post('/login', AdminControllers.login)

router.post('/forgot-password', AdminControllers.forgotPassword)

router.post('/reset-password/:id', AdminControllers.resetPassword)

////////////////////////////////////////////SHOES///////////////////////////////////////////////

router.get('/shoes', [isAuthenticated] ,AdminControllers.getShoes)

router.get('/shoes-brand/:brand/:gender', [isAuthenticated], AdminControllers.getShoeBrand)

router.get('/shoe/:id', [isAuthenticated] ,AdminControllers.getShoe)

router.post('/create-shoe', [isAuthenticated ,isAdmin] , multerStorage.single('image') ,AdminControllers.createShoe)

router.put('/update-shoe/:id', [isAuthenticated ,isAdmin] , AdminControllers.updateShoe);

router.put('/update-shoe-image/:id', [isAuthenticated, isAdmin], multerStorage.single('image'), AdminControllers.updateShoeImage);

router.delete('/delete-shoe/:id', [isAuthenticated ,isAdmin] , AdminControllers.deleteShoe);

router.get('/filter-shoes', [isAuthenticated], AdminControllers.filterShoes)

////////////////////////////////////////////SPECIFIC SHOES///////////////////////////////////////////////

router.get('/specific-shoe/:id', [isAuthenticated] ,AdminControllers.getSpecificShoe)

router.post('/create-specific-shoe/:id', [isAuthenticated ,isAdmin] , multerStorage.array('images') ,AdminControllers.createSpecificShoe)

router.put('/update-specific-shoe/:id', [isAuthenticated ,isAdmin], multerStorage.array('images') , AdminControllers.updateSpecificShoe);

router.delete('/delete-specific-shoe/:id', [isAuthenticated ,isAdmin] , AdminControllers.deleteSpecificShoe);

/////////////////////////////////////////////////DASHBOARD/////////////////////////////////////////////////////

router.get('/total-products', AdminControllers.total_products)

router.get('/total-orders', AdminControllers.total_orders)

router.get('/total-clients', AdminControllers.total_users)

router.get('/status-orders', AdminControllers.orders_status)

router.get('/ganancias', AdminControllers.ganancias)

router.get('/orders', AdminControllers.orders)

///////////////////////////////////////////////////////USUARIOS//////////////////////////////////////////////////////////

router.get('/users', AdminControllers.users_mayoristas)

router.post('/accept-mayorista', AdminControllers.accept_mayorista)

router.post('/decline-mayorista', AdminControllers.decline_mayorista)

module.exports = router