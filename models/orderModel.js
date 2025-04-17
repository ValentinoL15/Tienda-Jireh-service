const mongoose = require('mongoose')

const orderSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserModel',
      required: true
    },
    reference_id: {
      type: String,
      required: true
    },
    orderItems: 
      [{
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SpecificShoeModel',
          required: true
        },
        quantity: {
          type: Number,
          required: true
        },
        price: {
          type: Number,
          required: true
        },
        selectedSize: {
          type: Number,
          required: true
        }
      }]
    ,
    paymentMethod: {
      type: String, 
      default: "ePayco"
    },
    totalAmount: {
      type: Number,
      required: false
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    paidAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['Pendiente', 'processing', 'shipped', 'delivered', 'Rechazada', 'Aceptada'],
      default: 'Pendiente'
    },
    transactionId : {
      type: String
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
)

const OrderModel = mongoose.model('OrderModel', orderSchema);
module.exports = OrderModel;