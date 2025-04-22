const multer = require('multer');

const multerStorage = multer({
  storage: multer.memoryStorage(), // Store files in memory as buffers
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit to 5MB per file
    files: 10, // Limit to 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'), false);
    }
    cb(null, true);
  },
});

module.exports = multerStorage;