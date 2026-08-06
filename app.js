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
    // 1. Usuarios (Utilizando password_hash adaptado a tu base de datos)
    await db.query(`CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      apellidos VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      resetToken VARCHAR(255),
      resetTokenExpires DATETIME
    )`);

    // 2. Ejercicios
    await db.query(`CREATE TABLE IF NOT EXISTS ejercicios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      imagen_url VARCHAR(255),
      video_url VARCHAR(255)
    )`);

    // 3. Músculos
    await db.query(`CREATE TABLE IF NOT EXISTS musculos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL UNIQUE
    )`);

    // 4. Partes de los músculos
    await db.query(`CREATE TABLE IF NOT EXISTS partes_musculo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      musculo_id INT NOT NULL,
      nombre VARCHAR(50) NOT NULL,
      FOREIGN KEY (musculo_id) REFERENCES musculos(id) ON DELETE CASCADE
    )`);

    // 5. Relación Ejercicio - Músculos
    await db.query(`CREATE TABLE IF NOT EXISTS ejercicio_musculos (
      ejercicio_id INT NOT NULL,
      musculo_id INT NOT NULL,
      PRIMARY KEY (ejercicio_id, musculo_id),
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      FOREIGN KEY (musculo_id) REFERENCES musculos(id) ON DELETE CASCADE
    )`);

    // 6. Relación Ejercicio - Partes de Músculo
    await db.query(`CREATE TABLE IF NOT EXISTS ejercicio_partes (
      ejercicio_id INT NOT NULL,
      parte_musculo_id INT NOT NULL,
      PRIMARY KEY (ejercicio_id, parte_musculo_id),
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      FOREIGN KEY (parte_musculo_id) REFERENCES partes_musculo(id) ON DELETE CASCADE
    )`);

    // 7. Anotaciones
    await db.query(`CREATE TABLE IF NOT EXISTS anotaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      ejercicio_id INT NOT NULL,
      nota TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE
    )`);

    // 8. Rutinas
    await db.query(`CREATE TABLE IF NOT EXISTS rutinas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tipo VARCHAR(50) DEFAULT '',
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      UNIQUE (usuario_id, nombre)
    )`);

    // 9. Relación Rutina - Ejercicios
    await db.query(`CREATE TABLE IF NOT EXISTS rutina_ejercicios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rutina_id INT NOT NULL,
      ejercicio_id INT NOT NULL,
      notas TEXT,
      FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE,
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      UNIQUE (rutina_id, ejercicio_id)
    )`);

    // 10. Días de la semana
    await db.query(`CREATE TABLE IF NOT EXISTS dias_semana (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(20) NOT NULL UNIQUE
    )`);

    // 11. Relación Rutina - Días
    await db.query(`CREATE TABLE IF NOT EXISTS rutina_dias (
      rutina_id INT NOT NULL,
      dia_id INT NOT NULL,
      PRIMARY KEY (rutina_id, dia_id),
      FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE,
      FOREIGN KEY (dia_id) REFERENCES dias_semana(id) ON DELETE CASCADE
    )`);

    // 12. Series de Ejercicios en Rutina
    await db.query(`CREATE TABLE IF NOT EXISTS rutina_ejercicio_series (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rutina_ejercicio_id INT NOT NULL,
      dia_id INT NOT NULL,
      serie_num INT NOT NULL,
      repeticiones INT NOT NULL,
      peso DECIMAL(5,2) DEFAULT 0,
      FOREIGN KEY (rutina_ejercicio_id) REFERENCES rutina_ejercicios(id) ON DELETE CASCADE,
      FOREIGN KEY (dia_id) REFERENCES dias_semana(id) ON DELETE CASCADE,
      UNIQUE(rutina_ejercicio_id, dia_id, serie_num)
    )`);

    // ---------------------------------------------------------------------
    // POBLAR DATOS BASE (Ignorando si ya existen para evitar errores)
    // ---------------------------------------------------------------------
    
    // Inserción de Músculos Globales
    await db.query(`INSERT IGNORE INTO musculos (nombre) VALUES
      ('Pectoral'), ('Bíceps'), ('Tríceps'), ('Hombro'), ('Espalda'),
      ('Pierna'), ('Glúteo'), ('Abdomen'), ('Todo el cuerpo'), ('Cardio')`);

    // Inserción de Días
    await db.query(`INSERT IGNORE INTO dias_semana (nombre) VALUES
      ('Lunes'), ('Martes'), ('Miércoles'), ('Jueves'), ('Viernes'), ('Sábado'), ('Domingo')`);

    // Inserción de Partes Específicas de los Músculos
    const [partesExistentes] = await db.query('SELECT COUNT(*) AS total FROM partes_musculo');
    if (partesExistentes[0].total === 0) {
      const insertsPartes = [
        "('Bíceps', 'Cabeza larga')", "('Bíceps', 'Cabeza corta')",
        "('Tríceps', 'Cabeza larga')", "('Tríceps', 'Cabeza medial')", "('Tríceps', 'Cabeza lateral')",
        "('Hombro', 'Deltoides anterior')", "('Hombro', 'Deltoides lateral')", "('Hombro', 'Deltoides posterior')", "('Hombro', 'Manguito rotador')",
        "('Pectoral', 'Pectoral superior')", "('Pectoral', 'Pectoral medio')", "('Pectoral', 'Pectoral inferior')",
        "('Espalda', 'Dorsal ancho')", "('Espalda', 'Trapecio')",
        "('Pierna', 'Cuádriceps')", "('Pierna', 'Isquiotibiales')", "('Pierna', 'Aductores')", "('Pierna', 'Abductores')", "('Pierna', 'Gemelos')",
        "('Glúteo', 'Glúteo mayor')", "('Glúteo', 'Glúteo medio')",
        "('Abdomen', 'Recto abdominal \"six-pack\"')", "('Abdomen', 'Oblicuos externos')", "('Abdomen', 'Oblicuos internos')", "('Abdomen', 'Lumbares')"
      ];
      for (const item of insertsPartes) {
        await db.query(`INSERT INTO partes_musculo (musculo_id, nombre) 
          VALUES ((SELECT id FROM musculos WHERE nombre = ${item.split(',')[0].replace('(', '')} LIMIT 1), ${item.split(',')[1].replace(')', '')})`);
      }
    }

    // Inserción de Ejercicios Iniciales de ejemplo
    await db.query(`INSERT IGNORE INTO ejercicios (id, nombre, descripcion, imagen_url, video_url) VALUES
      (1, 'Curl de bíceps con barra Z', 'Ejercicio para trabajar la cabeza larga y corta del bíceps.', 'https://res.cloudinary.com/dkicsjbbb/image/upload/v1739186193/curl_biceps.jpg', ''),
      (2, 'Press banca', 'Ejercicio básico de pecho, trabaja pectoral mayor y menor, además de tríceps y deltoides anterior.', 'https://res.cloudinary.com/dkicsjbbb/image/upload/v1739186193/press_banca.jpg', '')`);

    // Inserción de Relaciones Ejercicio - Músculo
    await db.query(`INSERT IGNORE INTO ejercicio_musculos (ejercicio_id, musculo_id) VALUES
      (1, (SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1)),
      (2, (SELECT id FROM musculos WHERE nombre = 'Pectoral' LIMIT 1)),
      (2, (SELECT id FROM musculos WHERE nombre = 'Tríceps' LIMIT 1)),
      (2, (SELECT id FROM musculos WHERE nombre = 'Hombro' LIMIT 1))`);

    // Inserción de Relaciones Ejercicio - Partes de Músculo
    await db.query(`INSERT IGNORE INTO ejercicio_partes (ejercicio_id, parte_musculo_id) VALUES
      (1, (SELECT id FROM partes_musculo WHERE nombre = 'Cabeza larga' AND musculo_id = (SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1) LIMIT 1)),
      (1, (SELECT id FROM partes_musculo WHERE nombre = 'Cabeza corta' AND musculo_id = (SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1) LIMIT 1))`);

    console.log('🎉 ¡Todas las tablas, subpartes musculares y ejercicios inicializados con éxito!');
  } catch (error) {
    console.error('❌ Error al poblar la base de datos:', error.message);
  }
}

inicializarTablas();
