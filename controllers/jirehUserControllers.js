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
    return res.status(200).json({ message: 'Bienvenido', token, name, userExist });
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
    const limit = 6; // Si no se pasa un límite, por defecto 10

    // Ejecutar ambas consultas en paralelo para mejorar rendimiento
    const [products, total] = await Promise.all([
      ShoeModel.find({ discount: false }).limit(limit).skip(skip),
      ShoeModel.countDocuments({discount: false})
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

const get_offers = async(req,res) => {
  try {
    const offers = await ShoeModel.find({ discount: true })
    if(!offers){
      return res.status(400).json({ message: "No se encontraron productos con descuento" })
    }
    return res.status(200).json({ offers })
  } catch (err) {
    console.error('Error en GET /get_offers:', err);
    return res.status(500).json({ message: 'Ocurrió un error al obtener las ofertas' });
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

    const specificShoes = await Promise.all(
      orderItems.map(item => SpecificShoeModel.findById(item.product).populate('shoe_id'))
    );
    for (const [index, shoe] of specificShoes.entries()) {
      if (!shoe) {
        return res.status(404).json({ message: `Producto con ID ${orderItems[index].product} no encontrado` });
      }
      const stockKey = `talle_${orderItems[index].selectedSize}`;
      if (shoe[stockKey] < orderItems[index].quantity) {
        return res.status(400).json({ message: `Stock insuficiente para talla ${orderItems[index].selectedSize}` });
      }
    }

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: orderItems.map((item, index )=> ({
        price_data: {
          currency: 'cop', // Cambia a tu moneda
          product_data: {
            name: specificShoes[index].shoe_id.name, // Puedes obtener el nombre real desde SpecificShoeModel
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

const createCheckoutSession = async (req, res) => {
  const userId = req.userId;
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

  // Verificar productos y stock
  const specificShoes = await Promise.all(
    orderItems.map(item => SpecificShoeModel.findById(item.product).populate('shoe_id'))
  );
  for (const [index, shoe] of specificShoes.entries()) {
    if (!shoe) {
      return res.status(404).json({ message: `Producto con ID ${orderItems[index].product} no encontrado` });
    }
    if (!shoe.shoe_id) {
      return res.status(404).json({ message: `ShoeModel no encontrado para SpecificShoe ${orderItems[index].product}` });
    }
    const stockKey = orderItems[index].selectedSize; // Ya es "talle_38"
    if (shoe[stockKey] < orderItems[index].quantity) {
      return res.status(400).json({ message: `Stock insuficiente para talla ${orderItems[index].selectedSize}` });
    }
  }

  const usuario = await UserModel.findOne({ _id: userId });
  if (!usuario) {
    return res.status(404).json({ message: 'El usuario no existe' });
  }

  try {
    // Generar reference_id
    const generateReferenceId = () => {
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 100000);
      return `${timestamp}${randomNum}`;
    };
    const reference_id = generateReferenceId();

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: orderItems.map((item, index) => ({
        price_data: {
          currency: 'cop',
          product_data: {
            name: specificShoes[index].shoe_id.name,
            images: specificShoes[index].images.length > 0 ? [specificShoes[index].images[0]] : [],
            metadata: {
              specificShoeId: item.product,
              size: item.selectedSize
            }
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      ui_mode: 'embedded',
      client_reference_id: reference_id,
      customer_email: usuario.email,
      metadata: {
        userId: userId.toString(),
        orderItems: JSON.stringify(orderItems),
        totalAmount: totalAmount.toString(),
        paymentMethod
      },
      return_url: 'https://tienda-jireh-users.vercel.app/payment-response?session_id={CHECKOUT_SESSION_ID}',
    });

    return res.status(200).json({
      clientSecret: session.client_secret,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creando sesión de Stripe:', error);
    res.status(500).json({ message: 'Error interno' });
  }
};

const endpointSecret = 'whsec_L0Wf3GioVGknSqEtXGwHAzei1OZdA67u'; // Obtén esto desde el dashboard de Stripe
const webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  //const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const endpointSecret = 'whsec_L0Wf3GioVGknSqEtXGwHAzei1OZdA67u';

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('📩 Webhook recibido:', event.type);
  } catch (err) {
    console.error('❌ Error verificando webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const reference = session.client_reference_id;
        const userId = session.metadata.userId;
        const orderItems = JSON.parse(session.metadata.orderItems);
        const totalAmount = parseFloat(session.metadata.totalAmount);
        const paymentMethod = session.metadata.paymentMethod;

        // Iniciar transacción
        const dbSession = await mongoose.startSession();
        dbSession.startTransaction();

        try {
          // Verificar usuario
          const user = await UserModel.findById(userId).session(dbSession);
          if (!user) {
            console.error(`⚠️ Usuario no encontrado: ${userId}`);
            await dbSession.abortTransaction();
            return res.status(404).send('Usuario no encontrado');
          }

          // Verificar productos y stock
          const validSizes = [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44];
          for (const item of orderItems) {
            const sizeNumber = parseInt(item.selectedSize.replace('talle_', ''));
            if (!validSizes.includes(sizeNumber)) {
              console.warn(`⚠️ Talla inválida ${item.selectedSize}`);
              await dbSession.abortTransaction();
              return res.status(400).send(`Talla inválida ${item.selectedSize}`);
            }
            const shoe = await SpecificShoeModel.findById(item.product).session(dbSession);
            if (!shoe) {
              console.warn(`⚠️ SpecificShoeModel con ID ${item.product} no encontrado`);
              await dbSession.abortTransaction();
              return res.status(404).send(`Producto con ID ${item.product} no encontrado`);
            }
            const stockKey = item.selectedSize; // Ya es "talle_38"
            if (shoe[stockKey] < item.quantity) {
              console.warn(`⚠️ Stock insuficiente para talla ${item.selectedSize}`);
              await dbSession.abortTransaction();
              return res.status(400).send(`Stock insuficiente para talla ${item.selectedSize}`);
            }
          }

          // Crear la orden
          const newOrder = new OrderModel({
            user: userId,
            reference_id: reference,
            orderItems: orderItems.map(item => ({
              product: item.product,
              quantity: item.quantity,
              price: item.price,
              selectedSize: item.selectedSize
            })),
            paymentMethod,
            totalAmount,
            status: 'Aceptada',
            isPaid: true,
            transactionId: session.payment_intent,
            paidAt: new Date()
          });

          const savedOrder = await newOrder.save({ session: dbSession });

          // Actualizar stock y ventas
          for (const item of orderItems) {
            const stockKey = item.selectedSize;
            const shoe = await SpecificShoeModel.findById(item.product).session(dbSession);
            if (shoe) {
              shoe[stockKey] = Math.max(shoe[stockKey] - item.quantity, 0);
              shoe.sales = (shoe.sales || 0) + item.quantity;
              await shoe.save({ session: dbSession });
            }
          }

          // Agregar la orden al usuario
          if (!user.orders.includes(savedOrder._id)) {
            user.orders.push(savedOrder._id);
            await user.save({ session: dbSession });
          }

          // Confirmar transacción
          await dbSession.commitTransaction();
          console.log(`✅ Orden creada: ${savedOrder._id} => ${savedOrder.status}`);
        } catch (error) {
          await dbSession.abortTransaction();
          console.error(`❌ Error creando orden: ${error.message}`);
          throw error;
        } finally {
          dbSession.endSession();
        }
        break;
      }

      case 'checkout.session.expired': {
        console.log(`ℹ️ Sesión de pago expirada: ${event.data.object.client_reference_id}`);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        console.log(`ℹ️ Pago asíncrono fallido: ${event.data.object.client_reference_id}`);
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
  get_user,
  get_offers,
  createCheckoutSession
};