const mongoose = require('mongoose')

const userSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        },
        gender: {
            type: String,
            enum: ["Man", "Woman"],
            required: true
        },
        phone: {
            type: Number,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        rol: {
            type: String,
            default: 'USER'
        },
        bought: {
            type: Number,
            default: 0
        },
        discount: {
            type: Boolean,
            default: false
        },
        discountPercentage: {
            type: Number,
            default: 0
        }
    }
)

const UserModel = mongoose.model('UserModel', userSchema)
module.exports = UserModel