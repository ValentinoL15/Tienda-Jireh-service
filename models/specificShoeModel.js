const mongoose = require('mongoose');

const specificShoeSchema = mongoose.Schema(
    {
        shoe_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ShoeModel',
            required: true
        },
        talle_34: {
            type: Number,
            default: 0
        },
        talle_35: {
            type: Number,
            default: 0
        },
        talle_36: {
            type: Number,
            default: 0
        },
        talle_37: {
            type: Number,
            default: 0
        },
        talle_38: {
            type: Number,
            default: 0
        },
        talle_39: {
            type: Number,
            default: 0
        },
        talle_40: {
            type: Number,
            default: 0
        },
        talle_41: {
            type: Number,
            default: 0
        },
        talle_42: {
            type: Number,
            default: 0
        },
        talle_43: {
            type: Number,
            default: 0
        },
        talle_44: {
            type: Number,
            default: 0
        },
        sales: {
            type: Number,
            default: 0
        },
        images: {
            type: [String],
            required: true
        },
        public_ids: {
            type: [String]
        }
    },
    { 
        timestamps: true,
        versionKey: false 
    }
);

const SpecificShoeModel = mongoose.model('SpecificShoeModel', specificShoeSchema);
module.exports = SpecificShoeModel;