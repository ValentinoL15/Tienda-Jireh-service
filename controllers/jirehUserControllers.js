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
    const { name, lastName, gender, city, address, numberAddress, phone, email, password, isMayorista } = req.body
    const emailLowerCase = email.toLowerCase().trim()
    const info = await InfoModel.findOne()
    const userExist = await UserModel.findOne({ email: emailLowerCase })
    if (userExist) {
      return res.status(400).json({ message: "El correo electrónico ya existe" })
    }

    const numberAddressRegex = /^[a-zA-Z0-9\s\-\/]+$/;
    if (!numberAddressRegex.test(numberAddress)) {
      return res.status(400).json({ message: "El número de dirección es inválido" });
    }

    const passwordHashed = bcrypt.hashSync(password, 10)

    const register = new UserModel({
      name: name.trim(),
      lastName: lastName.trim(),
      gender,
      city,
      address,
      numberAddress,
      phone,
      isMayorista,
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
    console.log(error)
    return res.status(500).json({ error: 'Error al loguearse' });
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
const stripe = require('stripe')('sk_test_51RFDmzPDNG2XzTXTXSMWurbl7bn9ovo97s8Ry8TQ74OBl5CwrHqQ98i1ImFQ1X6oUKcEXahThwTkF5cyyqmdeHBq004QcPRM1D')
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

// Verificar productos
for (const item of orderItems) {
  const shoe = await SpecificShoeModel.findById(item.product);
  if (!shoe) {
    return res.status(404).json({ message: `Producto con ID ${item.product} no encontrado` });
  }
  // Verificar stock por talla
  const stockKey = `talle_${item.selectedSize}`;
  if (shoe[stockKey] < item.quantity) {
    return res.status(400).json({ message: `Stock insuficiente para talla ${item.selectedSize}` });
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
      orderItems: orderItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        selectedSize: item.selectedSize
      })),
      paymentMethod,
      totalAmount,
      status: 'Pendiente'
    });

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: orderItems.map(item => ({
        price_data: {
          currency: 'usd', // Cambia a tu moneda
          product_data: {
            name: `Producto ${item.product}`, // Puedes obtener el nombre real desde SpecificShoeModel
          },
          unit_amount: Math.round(item.price * 100), // Precio en centavos
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      ui_mode: 'embedded',
      client_reference_id: reference_id,
      customer_email: usuario.email,
      metadata: {
        orderId: newOrder._id.toString(),
        userId: userId.toString()
      },
      return_url: 'https://tienda-jireh-users.vercel.app/payment-response?session_id={CHECKOUT_SESSION_ID}', // Cambia a tu dominio
      //success_url: 'https://tienda-jireh-users.vercel.app/payment-response', // URL de éxito
      //cancel_url: 'https://your-domain.com/cancel' // URL de cancelación
    });

    const savedOrder = await newOrder.save();

    usuario.orders.push(savedOrder._id)
    await UserModel.updateOne(
      { _id: userId },
      { $push: { orders: savedOrder._id } }
    );

    return res.status(200).json({
      clientSecret: session.client_secret,
      sessionId: session.id,
      orderId: savedOrder._id
    });
  } catch (error) {
    console.error('Error creando orden', error);
    res.status(500).json({ message: 'Error interno' });
  }
};

const endpointSecret = 'whsec_L0Wf3GioVGknSqEtXGwHAzei1OZdA67u'; // Obtén esto desde el dashboard de Stripe
const webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  // Verificar la firma del webhook
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('📩 Webhook recibido:', event.type);
  } catch (err) {
    console.error('❌ Error verificando webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Manejar eventos específicos de Stripe
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const reference = session.client_reference_id;

        // Iniciar transacción
        const dbSession = await mongoose.startSession();
        dbSession.startTransaction();

        try {
          // Buscar la orden
          const orden = await OrderModel.findOne({ reference_id: reference }).session(dbSession);
          if (!orden) {
            console.warn(`⚠️ Orden con reference_id ${reference} no encontrada`);
            await dbSession.abortTransaction();
            return res.status(404).send('Orden no encontrada');
          }

          // Verificar si ya fue procesada (idempotencia)
          if (orden.isPaid && orden.status === 'Aceptada') {
            console.log(`ℹ️ Orden ${orden._id} ya procesada`);
            await dbSession.commitTransaction();
            return res.json({ received: true });
          }

          // Actualizar la orden
          const updateData = {
            transactionId: session.payment_intent,
            paidAt: new Date(),
            status: 'Aceptada',
            isPaid: true
          };

          const updatedOrder = await OrderModel.findByIdAndUpdate(
            orden._id,
            updateData,
            { new: true, session: dbSession }
          );

          // Actualizar stock y ventas
          const validSizes = [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44];
          for (const item of updatedOrder.orderItems) {
            if (!validSizes.includes(item.selectedSize)) {
              console.warn(`⚠️ Talla inválida ${item.selectedSize} en orden ${orden._id}`);
              continue;
            }

            const stockKey = `talle_${item.selectedSize}`;
            const shoe = await SpecificShoeModel.findById(item.product).session(dbSession);
            if (shoe) {
              shoe[stockKey] = Math.max(shoe[stockKey] - item.quantity, 0);
              shoe.sales = (shoe.sales || 0) + item.quantity;
              await shoe.save({ session: dbSession });
            } else {
              console.warn(`⚠️ SpecificShoeModel con ID ${item.product} no encontrado`);
            }
          }

          // Asegurarse de que la orden está en el usuario
          const user = await UserModel.findById(updatedOrder.user).session(dbSession);
          if (user && !user.orders.includes(updatedOrder._id)) {
            user.orders.push(updatedOrder._id);
            await user.save({ session: dbSession });
          }

          // Confirmar transacción
          await dbSession.commitTransaction();
          console.log(`✅ Estado de orden actualizado: ${updatedOrder._id} => ${updatedOrder.status}`);
        } catch (error) {
          await dbSession.abortTransaction();
          console.error(`❌ Error actualizando orden: ${error.message}`);
          throw error;
        } finally {
          dbSession.endSession();
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const reference = session.client_reference_id;

        // Buscar la orden
        const orden = await OrderModel.findOne({ reference_id: reference });
        if (!orden) {
          console.warn(`⚠️ Orden con reference_id ${reference} no encontrada`);
          return res.status(404).send('Orden no encontrada');
        }

        // Actualizar estado a Rechazada
        await OrderModel.findByIdAndUpdate(
          orden._id,
          { 
            status: 'Rechazada',
            isPaid: false 
          },
          { new: true }
        );

        console.log(`✅ Orden ${orden._id} marcada como Rechazada`);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const reference = session.client_reference_id;

        // Buscar la orden
        const orden = await OrderModel.findOne({ reference_id: reference });
        if (!orden) {
          console.warn(`⚠️ Orden con reference_id ${reference} no encontrada`);
          return res.status(404).send('Orden no encontrada');
        }

        // Actualizar estado a Rechazada
        await OrderModel.findByIdAndUpdate(
          orden._id,
          { 
            status: 'Rechazada',
            isPaid: false 
          },
          { new: true }
        );

        console.log(`✅ Orden ${orden._id} marcada como Rechazada por fallo de pago`);
        break;
      }

      default:
        console.log(`ℹ️ Evento no manejado: ${event.type}`);
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    return res.status(500).send('Internal server error');
  }
};

const verify_payment = async (req, res) => {
  const { sessionId } = req.params;

  try {
    // Obtener la sesión de Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verificar el estado del pago
    let status;
    if (session.payment_status === 'paid') {
      status = 'paid';
    } else if (session.payment_status === 'unpaid') {
      status = 'failed';
    } else if (session.payment_status === 'pending') {
      status = 'pending';
    } else {
      status = 'unknown';
    }

    // Opcional: Verificar la orden en la base de datos
    const order = await OrderModel.findOne({ reference_id: session.client_reference_id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    return res.json({
      success: true,
      status,
      orderId: order._id
    });
  } catch (error) {
    console.error('Error verifying Stripe payment:', error);
    return res.status(500).json({
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
  verify_payment,
  get_user
};