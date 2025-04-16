const userRegister = async(req,res, next) => {
  try {
    const { name, lastName, gender, city ,address, numberAddress, phone, email, password , isMayorista} = req.body
    
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
    if(!city){ 
      return res.status(400).json({ message: "La ciudad es requerida" })
    }
    if(!numberAddress){
      return res.status(400).json({ message: "El número de dirección es requerido"})
    }
    if(!phone){
      return res.status(400).json({ message: "El teléfono es requerido" })
    }
    if(!isMayorista) {
      return res.status(400).json({ message: "Debe seleccionar si es mayorista o no" })
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