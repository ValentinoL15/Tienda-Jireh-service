require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto-js');
const shortid = require('short-uuid');
const cloudinary = require('cloudinary');

///////////////////////////////////////////IMPORTACIONES DE MODELOS///////////////////////////////////////

const AdminModel = require('../models/adminModel.js')
const PasswordResetModel = require('../models/passwordResetModel.js')
const ShoeModel = require('../models/shoeModel.js')
const SpecificShoeModel = require('../models/specificShoeModel.js')
const OrdersModel = require('../models/orderModel.js')
const UserModel = require('../models/userModel.js')

/////////////////////////////////////////IMPORTACIONES SECUNDARIAS////////////////////////////////////////

const { sendEmailPassword } = require('../utils/envioEmails.js')
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_API_SECRET
})

////////////////////////////////////////REGISTRO & LOGIN DE ADMINISTRADOR/////////////////////////////////////////

const register = async (req, res) => {
    try {
        const { name, lastName, gender, phone, email, password } = req.body

        const emailLowerCase = email.toLowerCase();

        const admin_exist = await AdminModel.findOne({ email: emailLowerCase })

        if (admin_exist) return res.status(400).json({ message: "El admin ya esta logueado" })

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

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const normalizedEmail = email.toLowerCase();
        const adminExist = await AdminModel.findOne({ email: normalizedEmail }).select('+password')

        if (!adminExist) return res.status(400).send({ message: 'El Email proporcionado no existe' })

        const passwordMatch = await bcrypt.compare(password, adminExist.password)

        if (!passwordMatch) return res.status(400).send({ message: 'Contraseña incorrecta' })

        const token = jwt.sign({ id: adminExist._id, rol: adminExist.rol }, process.env.JWT_SECRET_KEY, { expiresIn: "2h" })

        return res.status(200).json({ message: 'Inicio de sesión con éxito', token })
    } catch (error) {
        console.log('Error/ login', error)

        return res.status(500).send({
            message: 'Ocurrió un error ingresando a la app'
        });
    }
}

const forgotPassword = async (req, res) => {
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
        await sendEmailPassword(id, admin.email);

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
        const adminFound = await AdminModel.findOne({ email: normalaizedEmail });
        if (!adminFound) return res.status(404).json({ message: 'Admin no encontrado' });

        const hashed = await bcrypt.hash(req.body.password, 10);
        await AdminModel.findByIdAndUpdate(adminFound._id, { password: hashed }, { new: true });
        await PasswordResetModel.findByIdAndDelete(reset._id);
        return res.status(200).json({ message: 'Contraseña actualizada con éxito' });

    } catch (error) {
        console.log('Error/ reset-password', error)
        return res.status(500).send({
            message: 'Ocurrió un error actualizando la contraseña'
        });
    }
}

////////////////////////////////////////SHOE////////////////////////////////////////

//DONE
const getShoes = async (req, res) => {
    try {
        const { skip, limit, brand, gender, type, reference_id } = req.query;

        // Construir el objeto de filtros dinámicamente
        const filters = {};
        if (brand) filters.brand = brand;
        if (gender) filters.gender = gender;
        if (type) filters.type = type;
        if (req.query.reference_id) {
            const searchTerm = req.query.reference_id.trim();
            filters.reference_id = { 
                $regex: `^${searchTerm}`, // ^ para que coincida desde el inicio del string
                $options: 'i' // 'i' para case-insensitive (opcional)
            };
        }

        const total = await ShoeModel.countDocuments(filters);  // Contar los productos con los filtros
        const shoes = await ShoeModel.find(filters)  // Filtrar productos por los filtros
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        return res.status(200).json({ shoes, total });
    } catch (error) {
        console.error('Error en /get-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error obteniendo los tenis' });
    }
};



//DONE
const getShoeBrand = async (req, res) => {
    try {
        const { brand, gender } = req.params
        const shoes = await ShoeModel.find({ brand, gender });
        if (!shoes) {
            return res.status(404).json({ message: 'No hay tenis de esta marca' })
        }
        return res.status(200).json({ shoes });
    } catch (error) {
        console.error('Error en /get-shoe-brand:', error);
        return res.status(500).json({ message: 'Ocurrió un error obteniendo los tenis de esta marca' });
    }
}

//DONE
const getShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const shoe = await ShoeModel.findById(id).populate({ path: 'shoes' })
        if (!shoe) return res.status(404).json({ message: 'Tenis no encontrado' });
        return res.status(200).json({ shoe });
    } catch (error) {
        console.error('Error en /get-shoe/:id:', error);
        return res.status(500).json({ message: 'Ocurrió un error obteniendo el tenis' });
    }
}

//DONE
const createShoe = async (req, res) => {
    try {
        const { name, gender, brand, material, type, price, discount } = req.body;

        let discount_percentage = 0;
        if (discount === 'true' && req.body.discount_percentage) {
            discount_percentage = parseFloat(req.body.discount_percentage);
            if (isNaN(discount_percentage)) {
                return res.status(400).json({ message: 'El porcentaje de descuento debe ser un número válido' });
            }
        }

        const shoeExist = await ShoeModel.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });
        if (shoeExist) return res.status(400).json({ message: 'El tenis ya existe' });

        if (!name) {
            return res.status(400).json({ message: 'El campo "Nombre" es obligatorio' });
        }

        if (!gender) {
            return res.status(400).json({ message: 'El campo "Género" es obligatorio' });
        }

        if (!brand) {
            return res.status(400).json({ message: 'El campo "Marca" es obligatorio' });
        }

        if (!material) {
            return res.status(400).json({ message: 'El campo "Material" es obligatorio' });
        }

        if (!type) {
            return res.status(400).json({ message: 'El campo "Tipo" es obligatorio' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'El campo "Imagen" es obligatorio (debe subir un archivo)' });
        }

        let reference_id;
        let existingShoe;

        // Generar un ID único
        do {
            const shortId = shortid.generate();
            reference_id = `#${shortId}`;
            existingShoe = await ShoeModel.findOne({ reference_id });
        } while (existingShoe); // Si existe, genera otro

        const result = await cloudinary.v2.uploader.upload(req.file.path);
        if (!result) {
            return res.status(400).json({ message: 'Error al subir la imagen a Cloudinary' });
        }
        const shoe = new ShoeModel({
            name,
            reference_id,
            gender,
            brand,
            material,
            price: discount === 'true' ? price - (price * discount_percentage / 100) : price,
            original_price: price,
            type,
            discount: discount === 'true',
            discount_percentage: discount === 'true' ? discount_percentage : 0,
            image: result.url,
            public_Id: result.public_id
        });

        await shoe.save();

        return res.status(201).json({ message: "Tenis creado correctamente" });
    } catch (error) {
        console.error('Error en /create-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error creando el zapato' });
    }
};

//DONE
const updateShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, gender, material, price, type, discount, discount_percentage } = req.body;

        // Buscar el tenis existente
        const shoe = await ShoeModel.findById(id);
        if (!shoe) return res.status(404).json({ message: 'Tenis no encontrado' });

        // Validar si el nombre ya existe con el mismo género
        if (name && name !== shoe.name) {
            const shoeExist = await ShoeModel.findOne({
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                gender
            });
            if (shoeExist) return res.status(400).json({ message: 'El tenis con ese nombre ya existe, por favor pruebe con otro' });
        }

        // Construir objeto de actualización dinámicamente
        const updateFields = {};
        Object.entries({ name, gender, material, price, type, discount, discount_percentage }).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                updateFields[key] = value;
            }
        });

        // Convertir discount de string a boolean si existe
        if (updateFields.discount !== undefined) {
            updateFields.discount = updateFields.discount === 'true';
        }

        // Si discount es false, asegurarse de que discount_percentage sea 0
        if (updateFields.discount !== undefined) {
            if (updateFields.discount === false) {
                // Si se desactiva el descuento, restaurar el precio original
                updateFields.price = shoe.original_price;
                updateFields.discount_percentage = 0;
            } else if (updateFields.discount === true && updateFields.discount_percentage !== undefined) {
                // Si se activa el descuento, calcular el nuevo precio
                const originalPrice = shoe.original_price;
                updateFields.price = originalPrice - (originalPrice * updateFields.discount_percentage / 100);
            }
        }
        // Si no hay cambios, no actualizar
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: 'No hay cambios para actualizar' });
        }

        await ShoeModel.findByIdAndUpdate(id, updateFields, { new: true });

        return res.status(200).json({ message: 'Tenis editado con éxito' });

    } catch (error) {
        console.error('Error en /edit-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error editando el tenis' });
    }
};

//DONE
const deleteShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const shoe = await ShoeModel.findById(id);
        if (!shoe) return res.status(404).json({ message: 'Tenis no encontrado' });
        if (shoe.public_id) {
            const result = await cloudinary.v2.uploader.destroy(shoe.public_id);
            if (result.result !== 'ok') {
                return res.status(400).json({ message: 'Error al eliminar la imagen de Cloudinary' });
            }
        };
        await ShoeModel.findByIdAndDelete(id);
        return res.status(200).json({ message: 'Tenis eliminado con éxito' });
    } catch (error) {
        console.error('Error en /delete-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error eliminando el tenis' });
    }
}

const filterShoes = async (req, res) => {
    try {
        const filter = {};

        if (req.query.reference_id) filter.reference_id = req.query.reference_id;

        const shoesFilter = await ShoeModel.find(filter);
        return res.status(200).json({ shoesFilter });
    } catch (error) {
        console.error('Error en /filter-shoes:', error);
        return res.status(500).json({ message: 'Ocurrió un error filtrando los tenis' });
    }
};


///////////////////////////////////////////////SPECIFIC-SHOE///////////////////////////////////////////////

//DONE
const getSpecificShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const specificShoe = await SpecificShoeModel.findById(id);
        if (!specificShoe) return res.status(404).json({ message: 'Tenis específico no encontrado' });
        return res.status(200).json({ specificShoe });
    } catch (error) {
        console.error('Error en /get-specific-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error obteniendo los tenis específicos' });
    }
}

//DONE
const createSpecificShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const { size, color, stock } = req.body;

        if (!size || !color || !req.file) {
            return res.status(400).json({ message: 'Por favor, complete todos los campos' });
        }

        const shoe = await ShoeModel.findById(id);
        if (!shoe) return res.status(404).json({ message: 'Tenis no encontrado' });

        const result = await cloudinary.v2.uploader.upload(req.file.path);
        if (!result) {
            return res.status(400).json({ message: 'Error al subir la imagen a Cloudinary' });
        }

        const existingShoe = await SpecificShoeModel.findOne({
            shoe_id: id,
            size,
            color
        });
        
        if (existingShoe) {
            return res.status(400).json({ message: 'Ya existe un tenis con ese tamaño y color' });
        }
        

        const specificShoe = new SpecificShoeModel({
            size,
            color,
            shoe_id: id,
            stock,
            image: result.url,
            public_id: result.public_id
        })

        await specificShoe.save();
        shoe.shoes.push(specificShoe._id);
        await shoe.save();
        return res.status(201).json({ message: 'Tenis creado correctamente' })

    } catch (error) {
        console.error('Error en /create-specific-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error creando el tenis específico' });
    }
};

const updateSpecificShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;

        const specificShoe = await SpecificShoeModel.findById(id);
        if (!specificShoe) {
            return res.status(404).json({ message: 'Tenis específico no encontrado' });
        }

        let updatedFields = {};

        if (stock !== undefined && stock !== specificShoe.stock) {
            updatedFields.stock = Number(stock);
        }

        if (req.file) {
            const result = await cloudinary.v2.uploader.upload(req.file.path);
            if (!result) {
                return res.status(400).json({ message: 'Error al subir la imagen a Cloudinary' });
            }
            await cloudinary.v2.uploader.destroy(specificShoe.public_id);
            updatedFields.image = result.url;
            updatedFields.public_id = result.public_id;
        }

        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({ message: 'No se detectaron cambios en los datos' });
        }

        await SpecificShoeModel.findByIdAndUpdate(id, updatedFields, { new: true });

        return res.status(200).json({ message: 'Tenis actualizado correctamente' });

    } catch (error) {
        console.error('Error en /edit-specific-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error editando el tenis específico' });
    }
};

//DONE
const deleteSpecificShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const specificShoe = await SpecificShoeModel.findById(id);
        if (!specificShoe) return res.status(404).json({ message: 'Tenis específico no encontrado' });

        const shoe = await ShoeModel.findOne({ _id: specificShoe.shoe_id });
        if (!shoe) return res.status(404).json({ message: 'Tenis no encontrado' });

        if (specificShoe.public_id) {
            const result = await cloudinary.v2.uploader.destroy(specificShoe.public_id);
            if (result.result !== 'ok') {
                return res.status(400).json({ message: 'Error al eliminar la imagen de Cloudinary' });
            }
        };

        for (const specificShoeId of shoe.shoes) {
            if (specificShoeId.toString() === id) {
                shoe.shoes.pull(specificShoeId);
                await shoe.save();
                break;
            }
        }

        await SpecificShoeModel.findByIdAndDelete(id);
        return res.status(200).json({ message: 'Tenis eliminado con éxito' });
    } catch (error) {
        console.error('Error en /delete-specific-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error eliminando el tenis específico' });
    }
}

///////////////////////////////////////////////DASHBOARD-INFO//////////////////////////////////////////////////////////

const total_products = async(req,res) => {
    try {
        const shoes = await SpecificShoeModel.find()
        if(!shoes){
            return res.status(404).json({message: 'No hay productos en la base de datos'})
        }
        let shoeTotal = 0;
        shoes.forEach((t) => {
            shoeTotal += t.stock
        })
        return res.status(200).json({shoeTotal})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: 'Ocurrió un error al obtener el total de productos'})
    }
}

const total_orders = async(req,res) => {
    try {
        const totalDocuments = await OrdersModel.countDocuments();
        return res.status(200).json({totalDocuments})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: 'Ocurrió un error al obtener el total de pedidos'})
    }
}

const total_users = async(req,res) => {
    try {
        const totalClients = await UserModel.countDocuments()
        return res.status(200).json({totalClients})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: 'Ocurrió un error al obtener el total de usuarios'})
    }
}

const orders_status = async(req,res) => {
    try {
        const orders = await OrdersModel.find()
        if(!orders){
            return res.status(404).json({message: 'No hay pedidos en la base de datos'})
        }
        let pendingOrders = 0;
        let acceptedOrders = 0;
        let rejectedOrders = 0;
        orders.forEach((p) => {
            if(p.status === 'Aceptada') {
                acceptedOrders++;
            }
            if(p.status === 'Pendiente') {
                pendingOrders++;
            }
            if(p.status === 'Rechazada') {
                rejectedOrders++;
            }
        })
        return res.status(200).json({pendingOrders, acceptedOrders, rejectedOrders})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: 'Ocurrió un error al obtener las ordenes'})
    }
}

const ganancias = async(req,res) => {
    try {
        const orders = await OrdersModel.find()
        if(!orders) {
            return res.status(404).json({message: 'No hay pedidos en la base de datos'})
        }
        let totalGanancias = 0;
        orders.forEach((g) => {
            if(g.status === 'Aceptada') {
                totalGanancias += g.totalAmount
            }
        })
        return res.status(200).json({totalGanancias})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: 'Ocurrió un error al obtener las ganancias'})
    }
}

const orders = async(req,res) => {
    try {
        const orders = await OrdersModel.find().populate({
            path: 'orderItems.product',
            populate: {
              path: 'shoe_id', // este es el campo dentro de SpecificShoeModel
                model: 'ShoeModel'
            }
        })
        if(!orders) {
            return res.status(404).json({message: 'No hay pedidos en la base de datos' })
        }
        return res.status(200).json({ orders })
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: 'Ocurrió un error al obtener las ordenes'})
    }
}

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword,
    createShoe,
    getShoes,
    getShoeBrand,
    getShoe,
    updateShoe,
    deleteShoe,
    filterShoes,
    createSpecificShoe,
    getSpecificShoe,
    updateSpecificShoe,
    deleteSpecificShoe,
    total_products,
    total_orders,
    total_users,
    orders_status,
    ganancias,
    orders
}