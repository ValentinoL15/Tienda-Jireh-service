const userRegister = async(req,res, next) => {
  try {
    const { name, lastName, gender, address, numberAddress, phone, email, password,  } = req.body
    if(!name){
      return res.status(400).json({ message: "El nombre es requerido" })
    }
    if(!lastName){
      return res.status(400).json({ message: "El apellido es requerido" })
    }
    if(!gender){
      return res.status(400).json({ message: "El género es requerido" })
    }
    if(!address){
      return res.status(400).json({ message: "La dirección es requerida" })
    }
    if(!numberAddress){
      return res.status(400).json({ message: "El número de dirección es requerido"})
    }
    if(!phone){
      return res.status(400).json({ message: "El teléfono es requerido" })
    }
    if(!email){
      return res.status(400).json({ message: "El correo electrónico es requerido" })
    }
    if(!password){
      return res.status(400).json({ message: "La contraseña es requerida" })
    }
    return next()
  } catch (error) {
    console.error(error)
  }
}

module.exports = { userRegister }