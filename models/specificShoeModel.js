const mongoose = require('mongoose');

const specificShoeSchema = mongoose.Schema(
    {
        shoe_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ShoeModel',
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        color: {
            type: String,
            enum: ['Blanco', 'Negro', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Rosa', 'Violeta', 'Naranja', 'Marron', 'Gris', 'Beige'],
            required: true
        },
        sales: {
            type: Number,
            default: 0
        },
        stock: {
            type: Number,
            default: 0
        },
        image: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
        },
    },
    { 
        timestamps: true,
        versionKey: false 
    }
)

const SpecificShoeModel = mongoose.model('SpecificShoeModel', specificShoeSchema)
module.exports = SpecificShoeModel