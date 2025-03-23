const mongoose = require('mongoose')

const shoeSchema = mongoose.Schema(
    {
        reference_id: {
            type: String,
            required:true
        },
        name: {
            type: String,
            required: true
        },
        gender: {
            type: String,
            enum: ["Man", "Women", "Unisex", "Kids"],
            required: true
        },
        material: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        type: {
            type: String,
            enum: ["Zapatilla", "Zapato", "Ojota","Botin", "Training"],
            required: true
        },
        brand: {
            type: String,
            enum: ["Nike", "Adidas", "New Balance", "Reebok", "Topper"],
            required: true
        },
        image: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
        },
        shoes: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'SpecificShoeModel',
        }
    },
    { 
        timestamps: true,
        versionKey: false 
    }
)

const ShoeModel = mongoose.model('ShoeModel', shoeSchema)
module.exports = ShoeModel