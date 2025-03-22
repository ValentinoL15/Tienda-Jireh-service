const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    }
);

module.exports = mongoose.model('passwordResetEmail', passwordResetSchema);