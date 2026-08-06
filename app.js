const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API backend funcionando');
});

//rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/routines', require('./routes/routines'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend server running at http://localhost:${PORT}`));

// =========================================================================
// INICIALIZACIÓN AUTOMÁTICA DE LA BASE DE DATOS DE FITLOVER
// =========================================================================
const db = require('./config/db');

async function inicializarTablas() {
  try {
    // Forzamos la actualización de las URLs de Cloudinary reales para los dos ejercicios base
    await db.query(`UPDATE ejercicios SET 
      descripcion = 'Ejercicio para trabajar la cabeza larga y corta del bíceps.',
      imagen_url = 'https://res.cloudinary.com/dkicsjbbb/image/upload/v1739186193/curl_biceps.jpg' 
      WHERE nombre = 'Curl de bíceps con barra Z' OR id = 1`);

    await db.query(`UPDATE ejercicios SET 
      descripcion = 'Ejercicio básico de pecho, trabaja pectoral mayor y menor, además de tríceps y deltoides anterior.',
      imagen_url = 'https://res.cloudinary.com/dkicsjbbb/image/upload/v1739186193/press_banca.jpg' 
      WHERE nombre = 'Press banca' OR id = 2`);

    // Comprobación rápida de salud de la base de datos
    await db.query('SHOW TABLES');
    console.log('✅ Base de datos FitLover conectada e imágenes de Cloudinary actualizadas con éxito.');
  } catch (error) {
    console.error('❌ Error al verificar o actualizar las imágenes:', error.message);
  }
}

inicializarTablas();
