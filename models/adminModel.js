const mongoose = require('mongoose')

const adminSchema = mongoose.Schema(
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
            default: "ADMIN"
        }
    }
)



const AdminModel = mongoose.model('AdminModel', adminSchema)
module.exports = AdminModel

