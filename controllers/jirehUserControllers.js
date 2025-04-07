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
const OrderModel = require('../models/orderModel.js')

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
      return res.status(400).json({ message: "El email no existe" })
    }
    const passwordMatch = await bcrypt.compare(password, userExist.password)
    if(!passwordMatch) {
      return res.status(400).json({ message: "Contraseña incorrecta" })
    }
    const token = jwt.sign({ id: userExist._id, rol: userExist.rol }, process.env.JWT_SECRET_KEY, { expiresIn: "2h" })
    const name = userExist.name
    res.status(200).json({ message: 'Bienvenido', token, name });
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

/////////////////////////////////////////////////////////////////PAYMENTS///////////////////////////////////////////////////////////////
const epayco = require('epayco-sdk-node')({
  apiKey: process.env.EPAYCO_PUBLIC_KEY,
  privateKey: process.env.EPAYCO_PRIVATE_KEY,
  lang: 'ES',
  test: true
});
const create_payment = async (req, res) => {
  const { id } = req.params
  const { user, orderItems, paymentMethod, totalAmount } = req.body;

  const shoeSpecific = await SpecificShoeModel.findOne({ shoe_id : id })
  if(!shoeSpecific){
    return res.status(404).json({ message: 'No se encontró el producto' })
  }

  try {
    // 1. Crear la orden en MongoDB
    const newOrder = new OrderModel({
      user : "67eea38555dc88f17442759b",
      orderItems,
      paymentMethod,
      totalAmount,
    });

    const savedOrder = await newOrder.save();
    
    res.status(200).json({
      name: 'Compra de zapatos',
      description: 'Pago en ecommerce',
      invoice: savedOrder._id.toString(),
      currency: 'COP',
      amount: totalAmount,
      country: 'CO',
      response: 'https://tienda-jireh-service-production.up.railway.app/verify',
      confirmation: 'https://tienda-jireh-service-production.up.railway.app/webhook'
    });
  } catch (error) {
    console.error('Error creando orden', error);
    res.status(500).json({ message: 'Error interno' });
  }
};

//app.post('/api/orders/webhook'
const webhook =  async (req, res) => {
  const data = req.body;

  try {
    if (data.x_response === 'Aceptada') {
      const orderId = data.x_id_invoice;

      await OrderModel.findByIdAndUpdate(orderId, {
        isPaid: true,
        paidAt: new Date(),
        transactionId: data.x_transaction_id,
        status: 'processing',
      });

      console.log(`🟢 Pago confirmado para orden ${orderId}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.sendStatus(500);
  }
};

const verify = async (req, res) => {
  try {
    const { ref_payco } = req.query;

    const epaycoResponse = await axios.get(`https://secure.epayco.co/validation/v1/reference/${ref_payco}`, {
      headers: {
        'Authorization': `Bearer ${process.env.EPAYCO_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Procesar la respuesta de ePayco
    const paymentData = epaycoResponse.data.data;
    
    res.json({
      success: true,
      status: paymentData.x_response,
      message: paymentData.x_response_reason_text,
      data: paymentData
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar el pago'
    });
  }
};

// Esta ruta sería opcional, solo si necesitas procesar algo en el backend antes de redirigir
/*router.get('/payment-response', async (req, res) => {
  try {
    const { ref_payco, x_ref_payco, x_response } = req.query;
    
    // Aquí puedes validar el pago con ePayco si lo necesitas
    console.log('Datos de respuesta:', req.query);
    
    // Redirige al frontend con los parámetros
    res.redirect(`https://tienda-jireh-users.vercel.app/payment-response?ref_payco=${ref_payco}`);
  } catch (error) {
    console.error('Error en payment-response:', error);
    res.redirect('https://tienda-jireh-users.vercel.app/payment-response?error=1');
  }
});*/

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  get_products,
  get_products_by_gender,
  get_product,
  create_payment,
  webhook,
  verify
};