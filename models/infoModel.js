const mongoose = require('mongoose')

const infoSchema = mongoose.Schema(
  {
    clients: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'UserModel'
    },
    totalEarn: {
      type: Number,
      default: 0
    }
  },
  { 
    timestamps: true,
    versionKey: false 
  }
)

const InfoModel = mongoose.model('InfoModel', infoSchema)
module.exports = InfoModel