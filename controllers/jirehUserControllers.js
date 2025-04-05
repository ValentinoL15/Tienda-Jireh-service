require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto-js');
const shortid = require('short-uuid');
const cloudinary = require('cloudinary');

///////////////////////////////////////////IMPORTACIONES DE MODELOS///////////////////////////////////////
const UserModel = require('../models/userModel.js')
const InfoModel = require('../models/infoModel.js')
const PasswordResetModel = require('../models/passwordResetModel.js')
const ShoeModel = require('../models/shoeModel.js')
const SpecificShoeModel = require('../models/specificShoeModel.js')

/////////////////////////////////////////IMPORTACIONES SECUNDARIAS////////////////////////////////////////
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_API_SECRET
})

////////////////////////////////////////REGISTRO & LOGIN DE USUARIO/////////////////////////////////////////

const register = async (req, res) => {
  try {
    const { name, lastName, gender, address, numberAddress, phone, email, password } = req.body
    const emailLowerCase = email.toLowerCase()
    const info = await InfoModel.findOne()
    const userExist = await UserModel.findOne({ email: emailLowerCase })
    if (userExist) {
      return res.status(400).json({ message: "El correo electrónico ya existe" })
    }
    const passwordHashed = bcrypt.hashSync(password, 10)
    
    const register = new UserModel({
      name,
      lastName,
      gender,
      address,
      numberAddress,
      phone,
      email,
      password: passwordHashed,
    })
    await register.save()
    info.clients.push(register._id)
    await info.save()
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error registering user' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const emailLowerCase = email.toLowerCase();
    const userExist = await UserModel.findOne({ email: emailLowerCase }).select('+password')
    if(!userExist) {
      return res.status(400).json({ message: "El correo electrónico no existe, por favor intente con otro" })
    }
    const passwordMatch = await bcrypt.compare(password, userExist.password)
    if(!passwordMatch) {
      return res.status(400).json({ message: "Contraseña incorrecta" })
    }
    const token = jwt.sign({ id: userExist._id, rol: userExist.rol }, process.env.JWT_SECRET_KEY, { expiresIn: "2h" })
    res.status(200).json({ message: 'Bienvenido', token });
  } catch (error) {
    res.status(500).json({ error: 'Error al loguearse' });
  }
};

const forgotPassword = async (req, res) => {
  try {
      const { email } = req.body
      const normalizedEmail = email.toLowerCase();
      const user = await UserModel.findOne({ email: normalizedEmail });

      if (!user) {
          return res.status(404).send({ message: 'Usuario no encontrado' });
      }

      const id = uuidv4()

      const request = new PasswordResetModel({
          id,
          email: normalizedEmail
      });

      await request.save();
      await sendEmailPassword(id, user.email);

      return res.status(200).json({ message: 'Email enviado con éxito' })

  } catch (error) {
      console.log('Error/ forgot-password', error)

      return res.status(500).send({
          message: 'Ocurrió un error enviando el email'
      });
  }
}

const resetPassword = async (req, res) => {
  try {
      const { id } = req.params;

      const reset = await PasswordResetModel.findOne({ id });
      if (!reset) return res.status(404).json({ message: 'Link no encontrado' });

      const normalaizedEmail = reset.email.toLowerCase();
      const userFound = await UserModel.findOne({ email: normalaizedEmail });
      if (!userFound) return res.status(404).json({ message: 'Usuario no encontrado' });

      const hashed = await bcrypt.hash(req.body.password, 10);
      await UserModel.findByIdAndUpdate(userFound._id, { password: hashed }, { new: true });
      await PasswordResetModel.findByIdAndDelete(reset._id);
      return res.status(200).json({ message: 'Contraseña actualizada con éxito' });

  } catch (error) {
      console.log('Error/ reset-password', error)
      return res.status(500).send({
          message: 'Ocurrió un error actualizando la contraseña'
      });
  }
}

/////////////////////////////////////////////////PRODUCTS////////////////////////////////////////////////////////////

const get_products = async (req, res) => { 
  try {
    // Obtener valores de consulta y asegurarse de que son números válidos
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10; // Si no se pasa un límite, por defecto 10

    // Ejecutar ambas consultas en paralelo para mejorar rendimiento
    const [products, total] = await Promise.all([
      ShoeModel.find().limit(limit).skip(skip),
      ShoeModel.countDocuments()
    ]);

    return res.status(200).json({ products, total });
  } catch (error) {
    console.error('Error en GET /get_products:', error);
    return res.status(500).json({ message: 'Ocurrió un error al obtener los productos' });
  }
};

const get_products_by_gender = async (req, res) => {
  try {
    const { brand, gender } = req.params;
    const shoes = await ShoeModel.find({ brand, gender });
    return res.status(200).json({ shoes });
  } catch (error) {
    console.error('Error en GET /get_products_by_gender:', error);
    return res.status(500).json({ message: 'Ocurrió un error al obtener los productos por género' });
  }
}

const get_product = async (req,res) => {
  try {
    const { id } = req.params;
    const product = await ShoeModel.findById(id).populate({path: 'shoes'})
    return res.status(200).json({ product });
  } catch (error) {
    console.error('Error en GET /get_product:', error);
    return res.status(500).json({ message: 'Ocurrió un error al obtener el producto' });
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  get_products,
  get_products_by_gender,
  get_product
};