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
        stock: {
            type: Number,
            required: true
        },
        color: {
            type: String,
            enum: ['White', 'Black', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Orange', 'Brown', 'Gray', 'Beige', 'Other'],
            required: true
        },
        sales: {
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
        discount: {
            type: Boolean,
            default: false
        },
        discountPercentage: {
            type: Number,
            default: 0
        }
    },
    { 
        timestamps: true,
        versionKey: false 
    }
)

const SpecificShoeModel = mongoose.model('SpecificShoeModel', specificShoeSchema)
module.exports = SpecificShoeModel