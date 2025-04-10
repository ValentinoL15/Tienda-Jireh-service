require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto-js');
const shortid = require('short-uuid');
const cloudinary = require('cloudinary');

const axios = require('axios');

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
    const { name, lastName, gender, city, address, numberAddress, phone, email, password } = req.body
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
      city,
      address,
      numberAddress,
      phone,
      email,
      password: passwordHashed,
    })
    await register.save()
    info.clients.push(register._id)
    await info.save()
    return res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user' });
    console.log(error)
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const emailLowerCase = email.toLowerCase();
    const userExist = await UserModel.findOne({ email: emailLowerCase }).select('+password')
    if (!userExist) {
      return res.status(400).json({ message: "El email no existe" })
    }
    const passwordMatch = await bcrypt.compare(password, userExist.password)
    if (!passwordMatch) {
      return res.status(400).json({ message: "Contraseña incorrecta" })
    }
    const token = jwt.sign({ id: userExist._id, rol: userExist.rol }, process.env.JWT_SECRET_KEY, { expiresIn: "2h" })
    const name = userExist.name
    return res.status(200).json({ message: 'Bienvenido', token, name });
  } catch (error) {
    return res.status(500).json({ error: 'Error al loguearse' });
    console.log(error)
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

const get_user = async (req, res) => {
  try {
    const userId = req.userId
    const user = await UserModel.findOne({ _id: userId })  
      .populate({
      path: 'orders',
      populate: {
        path: 'orderItems.product',
        model: 'SpecificShoeModel' // Asegurate que coincida con el nombre del modelo
      }
    });
  
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })
    return res.status(200).json({ user })
  } catch (error) {
    console.log('Error/ get_user', error)
    return res.status(500).send({
      message: 'Ocurrió un error obteniendo el usuario'
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

const get_product = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await ShoeModel.findById(id).populate({ path: 'shoes' })
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
  const userId = req.userId
  const { user, orderItems, paymentMethod, totalAmount } = req.body;

  if (!orderItems) {
    return res.status(400).json({ message: 'Falta la información de los productos (orderItems)' });
  }
  if (!paymentMethod) {
    return res.status(400).json({ message: 'Falta el método de pago (paymentMethod)' });
  }
  if (!user) {
    return res.status(400).json({ message: 'Falta la información del usuario (user)' });
  }

  for (const item of orderItems) {
    const shoeExists = await SpecificShoeModel.find(item._id);
    if (!shoeExists) {
      return res.status(404).json({ message: `Producto con ID ${item._id} no encontrado` });
    }
  }

  const usuario = await UserModel.findOne({ _id : userId })
  if(!usuario){
    return res.status(404).json({ message: 'El usuario no existe' })
  }

  try {
    const generateReferenceId = () => {
      const timestamp = Date.now(); // Milisegundos desde 1970
      const randomNum = Math.floor(Math.random() * 100000); // 5 dígitos aleatorios
      return `${timestamp}${randomNum}`;
    };
    const reference_id = generateReferenceId();
    const newOrder = new OrderModel({
      user: userId,
      reference_id,
      orderItems,
      paymentMethod,
      totalAmount,
    });

    const savedOrder = await newOrder.save();
    usuario.orders.push(savedOrder._id)
    await usuario.save()

    return res.status(200).json({
      name: 'Compra de zapatos',
      description: 'Pago en ecommerce',
      invoice: savedOrder._id.toString(),
      currency: 'COP',
      amount: totalAmount,
      country: 'CO',
      response: 'https://tienda-jireh-users.vercel.app/payment-response',
      confirmation: 'https://tienda-jireh-service-production.up.railway.app/api/userJireh/webhook',
      method_confirmation: 'POST', // << NECESARIO
    });
  } catch (error) {
    console.error('Error creando orden', error);
    res.status(500).json({ message: 'Error interno' });
  }
};

const isValidSignature = (data, privateKey) => {
  const signatureString = `${data.x_cust_id_cliente}^${data.x_ref_payco}^${data.x_transaction_id}^${data.x_amount}^${data.x_currency_code}`;
  const generatedSignature = crypto.createHash('sha256').update(signatureString + privateKey).digest('hex');
  return generatedSignature === data.x_signature;
};
const privateKey = process.env.EPAYCO_PRIVATE_KEY;

const webhook = async (req, res) => {
  const data = req.body;

  try {
    console.log('📩 Webhook recibido:', data);

    const reference = data.x_id_invoice;
    const orden = await OrderModel.findById(reference);
    if (!orden) {
      return res.status(404).send('Orden no encontrada');
    }

    const transactionStatus = data.x_response;
    const updateData = {
      transactionId: data.x_transaction_id,
      paidAt: new Date(),
    };

    switch (transactionStatus) {
      case 'Aceptada':
        updateData.status = 'Aceptada';
        updateData.isPaid = true;
        break;
      case 'Rechazada':
        updateData.status = 'Rechazada';
        updateData.isPaid = false;
        break;
      case 'Pendiente':
        updateData.status = 'Pendiente';
        updateData.isPaid = false;
        break;
      default:
        updateData.status = transactionStatus || 'Desconocido';
        updateData.isPaid = false;
        break;
    }

    // Actualizamos la orden
    const updatedOrder = await OrderModel.findByIdAndUpdate(orden._id, updateData, { new: true });

    // Asegurarse de que la orden sigue estando en el usuario
    const user = await UserModel.findById(updatedOrder.user);
    if (user && !user.orders.includes(updatedOrder._id)) {
      user.orders.push(updatedOrder._id);
      await user.save();
    }

    console.log(`✅ Estado de orden actualizado: ${updatedOrder._id} => ${updatedOrder.status}`);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    res.status(500).send('Internal server error');
  }
};

const verify = async (req, res) => {
  try {
    const { ref_payco } = req.query;
    const userId = req.userId;

    console.log('🟡 Verificando ref_payco:', ref_payco);

    if (!ref_payco) {
      return res.status(400).json({ success: false, message: 'Referencia de pago no proporcionada' });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const epaycoResponse = await axios.get(`https://secure.epayco.co/validation/v1/reference/${ref_payco}`);
    const paymentData = epaycoResponse.data?.data;

    console.log('🔍 Datos recibidos de ePayco:', paymentData);

    if (!paymentData) {
      return res.status(400).json({ success: false, message: 'No se recibieron datos de ePayco' });
    }

    const referenceId = paymentData?.x_id_invoice;
    const transactionStatus = paymentData?.x_response;
    const transactionId = paymentData?.x_transaction_id;

    if (!referenceId) {
      return res.status(400).json({ success: false, message: 'No se encontró el ID de la orden en la respuesta de ePayco' });
    }

    const order = await OrderModel.findOne({ _id  : referenceId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }


    // Agregar la orden al usuario solo si no existe aún

    console.log('🟢 Orden actualizada y asociada al usuario');

    return res.json({
      success: true,
      status: transactionStatus,
      message: paymentData?.x_response_reason_text,
      data: paymentData
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error?.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: 'Error al verificar el pago',
      error: error?.response?.data || error.message
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
  verify,
  get_user
};