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
            enum: ["Hombre", "Mujer"],
            required: true
        },
        phone: {
            type: Number,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        numberAddress: {
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
        isMayorista: {
            type: Boolean,
            required: true
        },
        verifyMayorista: {
            type: Boolean,
            default: false
        },
        orders: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'OrderModel',
            default: []
        }
    }
)

const UserModel = mongoose.model('UserModel', userSchema)
module.exports = UserModel