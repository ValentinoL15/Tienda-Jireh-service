const mongoose = require('mongoose');
require('dotenv').config();

const connectToDatabase = (databaseURI) => {
    return new Promise((resolve, reject) => {
        mongoose.connect(process.env.DATABASE_URI)
            .then(() => {
                console.log('[TiendaJirehService] Base de datos conectada con éxito');
                resolve();
            })
            .catch((error) => {
                console.error('[TiendaJirehService] Error al conectar a la base de datos:', error);
                reject(error);
            });
    });
};

module.exports = {
    connectToDatabase
}