require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

///////////////////////////////////////////IMPORTACIONES DE MODELOS///////////////////////////////////////

const AdminModel = require('../models/adminModel.js')
const PasswordResetModel = require('../models/passwordResetModel.js')

/////////////////////////////////////////IMPORTACIONES SECUNDARIAS////////////////////////////////////////

const { sendEmailPassword } = require('../utils/envioEmails.js')

////////////////////////////////////////REGISTRO DE ADMINISTRADOR/////////////////////////////////////////

const register = async(req,res) => {
    try {
        const { name, lastName, gender, phone, email, password } = req.body

        const emailLowerCase = email.toLowerCase();

        const admin_exist = await AdminModel.findOne({ email: emailLowerCase })

        if(admin_exist) return res.status(400).json({ message: "El admin ya esta logueado" })

        const passwordHashed = bcrypt.hashSync(password, 10)
        const register = new AdminModel({
            name,
            lastName,
            gender,
            phone,
            email: emailLowerCase,
            password: passwordHashed
        })
        await register.save()
        return res.status(200).json({ message: "Administrador creado correctamente" })
    } catch (error) {
        console.log('Error /register', error);

        return res.status(500).send({
            message: 'Ocurrió un error creando el administrador'
        });
    }
}

const login = async(req,res) => {
    try {
        const { email, password } = req.body;

        const normalizedEmail = email.toLowerCase();
        const adminExist = await AdminModel.findOne({ email: normalizedEmail }).select('+password')

        if(!adminExist) return res.status(400).json({ message: 'El administrador no existe' })
        
        const passwordMatch = await bcrypt.compare(password, adminExist.password)

        if(!passwordMatch) return res.status(400).json({ message: 'Contraseña incorrecta' })

        const token = jwt.sign({ id: adminExist._id, rol: adminExist.rol }, process.env.JWT_SECRET_KEY, { expiresIn: "2h" })

        return res.status(200).json({ message: 'Inicio de sesión con éxito', token })
    } catch (error) {
        console.log('Error/ login', error)

        return res.status(500).send({
            message: 'Ocurrió un error ingresando a la app'
        });
    }
}

const forgotPassword = async(req,res) => {
    try {
        const { email } = req.body
        const normalizedEmail = email.toLowerCase();
        const admin = await AdminModel.findOne({ email: normalizedEmail });

        if (!admin) {
            return res.status(404).send({ message: 'Admin not found' });
        }

        const id = uuidv4()

        const request = new PasswordResetModel({
            id,
            email: normalizedEmail
        });

        await request.save();
        await sendEmailPassword(id ,admin.email);

        return res.status(200).json({ message: 'Email enviado con éxito' })

    } catch (error) {
        console.log('Error/ forgot-password', error)

        return res.status(500).send({
            message: 'Ocurrió un error enviando el email'
        });
    }
}

module.exports = { 
    register,
    login,
    forgotPassword
}