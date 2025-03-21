const jwt = require('jsonwebtoken');

const isAuthenticated = async (req, res, next) => {
    if (!req?.headers?.authorization) return res.status(400).json({ message: 'No se introdujo el token' });

    /* Getting the token from the header and splitting it into an array. */
    const bearer_token = req.headers.authorization;
    const bearer_token_split = bearer_token.split(' ');
    if (bearer_token_split.length !== 2) return res.json({ message: 'Autorización inválida, recuerde colocar el Bearer + Token' });
    const token = bearer_token_split[1];

    try {
        /* Verifying the token. */
        const token_data = jwt.verify(token, process.env.JWT_SECRET_KEY);

        const { id: userId, rol } = token_data;
        req.userId = userId;
        req.userRole = rol
        next();

    } catch (error) {
        console.log('Error de Autenticación', error);

        res.status(401).json({
            message: 'Ocurrió un error validando el token',
            error
        });
    }
};

module.exports = { isAuthenticated }