const AdminModel = require('../models/adminModel.js');

const isAdmin = async (req, res, next) => {

    const userFound = await AdminModel.findOne({ _id: req.userId });

    if(!userFound) return res.status(404).send({ message: 'Usuario no encontrado' });

    if(userFound.rol === "ADMIN") {
        return next();
    }

    return res.status(401).send({ message: 'No tienes permisos de administrador para realizar estas funciones' });

};

module.exports = { isAdmin };
