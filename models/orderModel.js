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
        }
      }]
    ,
    paymentMethod: {
      type: String, 
      default: "ePayco"
    },
    totalAmount: {
      type: Number,
      required: true
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
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: null
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