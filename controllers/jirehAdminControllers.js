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
        const { name, gender, brand, material, type, price, discount, percentage_mayorista } = req.body;

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
            percentage_mayorista,
            price_mayorista: price - (price * percentage_mayorista / 100),
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
        const {
            name,
            gender,
            material,
            price,
            type,
            discount,
            discount_percentage,
            percentage_mayorista
        } = req.body;

        const shoe = await ShoeModel.findById(id);
        if (!shoe) return res.status(404).json({ message: 'Tenis no encontrado' });

        // Validación de nombre duplicado
        if (name && name !== shoe.name) {
            const shoeExist = await ShoeModel.findOne({
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                gender
            });
            if (shoeExist) return res.status(400).json({ message: 'El tenis con ese nombre ya existe, por favor pruebe con otro' });
        }

        const updateFields = {};
        Object.entries({ name, gender, material, price, type, discount, discount_percentage, percentage_mayorista }).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                updateFields[key] = value;
            }
        });

        // Convertir discount a boolean
        if (updateFields.discount !== undefined) {
            updateFields.discount = updateFields.discount === 'true';
        }

        // Descuento
        if (updateFields.discount !== undefined) {
            if (updateFields.discount === false) {
                updateFields.price = shoe.original_price;
                updateFields.discount_percentage = 0;
            } else if (updateFields.discount === true && updateFields.discount_percentage !== undefined) {
                const originalPrice = shoe.original_price;
                updateFields.price = originalPrice - (originalPrice * updateFields.discount_percentage / 100);
            }
        }

        // Calcular price_mayorista si se actualiza el porcentaje
        if (updateFields.percentage_mayorista !== undefined) {
            const percentage = parseFloat(updateFields.percentage_mayorista);
            if (isNaN(percentage)) {
                return res.status(400).json({ message: 'El porcentaje mayorista debe ser un número válido' });
            }
            updateFields.price_mayorista = shoe.original_price - (shoe.original_price * percentage / 100);
        }

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

const updateShoeImage = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID
        /*if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'ID de tenis inválido' });
        }*/

        // Check if file is provided
        if (!req.file) {
            return res.status(400).json({ message: 'Se requiere una imagen' });
        }

        // Find the shoe
        const shoe = await ShoeModel.findById(id);
        if (!shoe) {
            return res.status(404).json({ message: 'Tenis no encontrado' });
        }

        // Validate file buffer and mimetype
        if (!req.file.buffer || !req.file.mimetype) {
            console.error('Archivo inválido:', req.file);
            return res.status(400).json({ message: 'Archivo de imagen inválido' });
        }

        // Upload new image to Cloudinary
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const result = await cloudinary.uploader.upload(base64Image, {
            folder: 'tienda-jireh',
            public_id: `shoe_${id}_${Date.now()}`,
        }).catch(err => {
            console.error('Error al subir imagen a Cloudinary:', err);
            throw new Error('Error al subir imagen a Cloudinary');
        });

        // Update image and public_id
        shoe.image = result.secure_url;
        shoe.public_id = result.public_id;

        // Save the updated document
        await shoe.save();

        console.log('Imagen de tenis actualizada:', {
            id: shoe._id,
            image: shoe.image,
            public_id: shoe.public_id,
        });

        return res.status(200).json({
            message: 'Imagen de tenis actualizada correctamente',
            shoe: shoe.toObject(),
        });
    } catch (error) {
        console.error('Error en /update-shoe-image:', error);
        return res.status(500).json({
            message: 'Error al actualizar la imagen del tenis',
            error: error.message,
        });
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
        const talles = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Se requieren al menos una imagen' });
        }

        const shoe = await ShoeModel.findById(id);
        if (!shoe) return res.status(404).json({ message: 'Tenis no encontrado' });

        // Crear objeto con campos válidos de talles
        const stockTalles = {};
        let hayStock = false;

        for (let i = 34; i <= 44; i++) {
            const key = `talle_${i}`;
            const stock = parseInt(talles[key]);
            if (!isNaN(stock) && stock >= 0) {
                stockTalles[key] = stock;
                if (stock > 0) hayStock = true;
            }
        }

        if (!hayStock) {
            return res.status(400).json({ message: 'Debe ingresar al menos un talle con stock mayor a 0' });
        }

        // Verificar si ya existe un específico con los mismos talles para este modelo
        /* const existing = await SpecificShoeModel.findOne({
           shoe_id: id,
           ...stockTalles,
         });
     
         if (existing) {
           return res.status(400).json({ message: 'Ya existe un tenis con esos talles para este modelo' });
         }*/

        // Subir imágenes a Cloudinary
        const imageUploadResults = await Promise.all(
            req.files.map(async (file, index) => {
                if (!file.buffer || !file.mimetype) {
                    throw new Error(`Archivo inválido en índice ${index}`);
                }
                const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
                return cloudinary.uploader.upload(base64Image, {
                    folder: 'tienda-jireh',
                    public_id: `shoe_${id}_${index}_${Date.now()}`,
                });
            })
        );

        const images = imageUploadResults.map(img => img.secure_url);
        const public_ids = imageUploadResults.map(img => img.public_id);

        const specificShoe = new SpecificShoeModel({
            shoe_id: id,
            images,
            public_ids,
            ...stockTalles,
        });

        await specificShoe.save();
        shoe.shoes.push(specificShoe._id);
        await shoe.save();

        console.log('Tenis creado:', specificShoe);
        return res.status(201).json({ message: 'Tenis creado correctamente', specificShoe });
    } catch (error) {
        console.error('Error en /create-specific-shoe:', error);
        return res.status(500).json({ message: 'Ocurrió un error creando el tenis específico', error: error.message });
    }
};

const updateSpecificShoe = async (req, res) => {
    try {
        const { id } = req.params;
        const { replaceIndexes, ...talles } = req.body;

        console.log('Body recibido:', req.body);
        console.log('Archivos recibidos:', req.files);

        const specificShoe = await SpecificShoeModel.findById(id);
        if (!specificShoe) {
            return res.status(404).json({ message: 'Tenis específico no encontrado' });
        }

        let hayCambios = false;

        // 🔁 Actualizar talles
        for (let i = 34; i <= 44; i++) {
            const key = `talle_${i}`;
            if (key in talles) {
                const nuevoValor = parseInt(talles[key]);
                if (!isNaN(nuevoValor) && nuevoValor >= 0) {
                    specificShoe[key] = nuevoValor;
                    hayCambios = true;
                }
            }
        }

        // 📸 Actualizar imágenes si se enviaron
        if (req.files && Array.isArray(req.files) && req.files.length > 0 && replaceIndexes) {
            const indexes = Array.isArray(replaceIndexes)
                ? replaceIndexes.map((i) => parseInt(i))
                : [parseInt(replaceIndexes)];

            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const index = indexes[i];

                // Validar que el archivo y el buffer existan
                if (!file || !file.buffer || !file.mimetype) {
                    console.error(`Archivo inválido en índice ${i}:`, file);
                    continue;
                }

                if (index >= 0 && index < specificShoe.images.length) {
                    // Convertir el buffer a base64
                    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

                    // Subir a Cloudinary
                    const result = await cloudinary.uploader.upload(base64Image, {
                        folder: 'tienda-jireh',
                        public_id: `shoe_${id}_${index}_${Date.now()}`,
                    }).catch(err => {
                        console.error(`Error al subir imagen ${i} a Cloudinary:`, err);
                        throw new Error('Error al subir imagen a Cloudinary');
                    });

                    // Reemplazar la URL en el array de imágenes
                    console.log(`Reemplazando imagen en índice ${index}: ${specificShoe.images[index]} -> ${result.secure_url}`);
                    specificShoe.images[index] = result.secure_url;
                    hayCambios = true;
                } else {
                    console.warn(`Índice inválido: ${index} (longitud del array: ${specificShoe.images.length})`);
                }
            }
        } else {
            console.log('No se recibieron archivos o replaceIndexes:', { files: req.files, replaceIndexes });
        }

        if (!hayCambios) {
            console.log('No hubo cambios en el documento:', specificShoe);
            return res.status(400).json({ message: 'No se proporcionaron datos válidos para actualizar' });
        }

        await specificShoe.save();
        console.log('Documento actualizado:', specificShoe);
        return res.status(200).json({ message: 'Tenis actualizado correctamente', specificShoe });
    } catch (error) {
        console.error('Error en /update-specific-shoe:', error);
        return res.status(500).json({ message: 'Error al actualizar el tenis específico', error: error.message });
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

        if (specificShoe.public_ids && specificShoe.public_ids.length > 0) {
            for (const public_id of specificShoe.public_ids) {
                const result = await cloudinary.v2.uploader.destroy(public_id);
                if (result.result !== 'ok') {
                    return res.status(400).json({ message: 'Error al eliminar la imagen de Cloudinary', public_id });
                }
            }
        }
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

const total_products = async (req, res) => {
    try {
        const shoeTotal = await ShoeModel.countDocuments()
        if (!shoeTotal) {
            return res.status(404).json({ message: 'No hay productos en la base de datos' })
        }

        return res.status(200).json({ shoeTotal })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Ocurrió un error al obtener el total de productos' })
    }
}

const total_orders = async (req, res) => {
    try {
        const totalDocuments = await OrdersModel.countDocuments();
        return res.status(200).json({ totalDocuments })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Ocurrió un error al obtener el total de pedidos' })
    }
}

const total_users = async (req, res) => {
    try {
        const totalClients = await UserModel.countDocuments()
        return res.status(200).json({ totalClients })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Ocurrió un error al obtener el total de usuarios' })
    }
}

const orders_status = async (req, res) => {
    try {
        const orders = await OrdersModel.find()
        if (!orders) {
            return res.status(404).json({ message: 'No hay pedidos en la base de datos' })
        }
        let pendingOrders = 0;
        let acceptedOrders = 0;
        let rejectedOrders = 0;
        orders.forEach((p) => {
            if (p.status === 'Aceptada') {
                acceptedOrders++;
            }
            if (p.status === 'Pendiente') {
                pendingOrders++;
            }
            if (p.status === 'Rechazada') {
                rejectedOrders++;
            }
        })
        return res.status(200).json({ pendingOrders, acceptedOrders, rejectedOrders })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Ocurrió un error al obtener las ordenes' })
    }
}

const ganancias = async (req, res) => {
    try {
        const orders = await OrdersModel.find()
        if (!orders) {
            return res.status(404).json({ message: 'No hay pedidos en la base de datos' })
        }
        let totalGanancias = 0;
        orders.forEach((g) => {
            if (g.status === 'Aceptada') {
                totalGanancias += g.totalAmount
            }
        })
        return res.status(200).json({ totalGanancias })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Ocurrió un error al obtener las ganancias' })
    }
}

const orders = async (req, res) => {
    try {
        const orders = await OrdersModel.find().populate({
            path: 'orderItems.product',
            populate: {
                path: 'shoe_id', // este es el campo dentro de SpecificShoeModel
                model: 'ShoeModel'
            }
        })
        if (!orders) {
            return res.status(404).json({ message: 'No hay pedidos en la base de datos' })
        }
        return res.status(200).json({ orders })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Ocurrió un error al obtener las ordenes' })
    }
}

/********************************************************USUARIOS**********************************************************/

const users_mayoristas = async (req, res) => {
    try {
        const users = await UserModel.find({ isMayorista: true })
        if (!users) {
            return res.status(404).json({ message: 'No hay usuarios en la base de datos' })
        }
        return res.status(200).json({ users })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Ocurrió un error al obtener los usuarios' })
    }
}

const accept_mayorista = async (req, res) => {
    try {
        const { _id } = req.body; // <-- CAMBIADO a body
        const updatedUser = await UserModel.findByIdAndUpdate(_id, { verifyMayorista: true }, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        return res.status(200).json({ message: 'Usuario verificado con éxito' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Ocurrió un error al aceptar el mayorista' });
    }
};

const decline_mayorista = async (req, res) => {
    try {
        const { _id } = req.body;
        const updatedUser = await UserModel.findByIdAndUpdate(_id, { verifyMayorista: false }, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        return res.status(200).json({ message: 'Verificación revocada con éxito' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Ocurrió un error al revocar el mayorista' });
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
    updateShoeImage,
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
    orders,
    users_mayoristas,
    accept_mayorista,
    decline_mayorista
}