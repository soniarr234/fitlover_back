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

const db = require('./config/db');

async function inicializarTablas() {
  try {
    // 1. Ejercicios
    await db.query(`CREATE TABLE IF NOT EXISTS ejercicios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      imagen_url VARCHAR(255),
      video_url VARCHAR(255)
    )`);

    // 2. Músculos
    await db.query(`CREATE TABLE IF NOT EXISTS musculos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL UNIQUE
    )`);

    // 3. Partes Músculo
    await db.query(`CREATE TABLE IF NOT EXISTS partes_musculo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      musculo_id INT NOT NULL,
      nombre VARCHAR(50) NOT NULL,
      FOREIGN KEY (musculo_id) REFERENCES musculos(id) ON DELETE CASCADE
    )`);

    // 4. Relación Ejercicio-Músculos
    await db.query(`CREATE TABLE IF NOT EXISTS ejercicio_musculos (
      ejercicio_id INT NOT NULL,
      musculo_id INT NOT NULL,
      PRIMARY KEY (ejercicio_id, musculo_id),
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      FOREIGN KEY (musculo_id) REFERENCES musculos(id) ON DELETE CASCADE
    )`);

    // 5. Relación Ejercicio-Partes
    await db.query(`CREATE TABLE IF NOT EXISTS ejercicio_partes (
      ejercicio_id INT NOT NULL,
      parte_musculo_id INT NOT NULL,
      PRIMARY KEY (ejercicio_id, parte_musculo_id),
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      FOREIGN KEY (parte_musculo_id) REFERENCES partes_musculo(id) ON DELETE CASCADE
    )`);

    // 6. Anotaciones
    await db.query(`CREATE TABLE IF NOT EXISTS anotaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      ejercicio_id INT NOT NULL,
      nota TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE
    )`);

    // 7. Rutinas
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

    // 8. Relación Rutina-Ejercicios
    await db.query(`CREATE TABLE IF NOT EXISTS rutina_ejercicios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rutina_id INT NOT NULL,
      ejercicio_id INT NOT NULL,
      notas TEXT,
      FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE,
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      UNIQUE (rutina_id, ejercicio_id)
    )`);

    // 9. Días Semana
    await db.query(`CREATE TABLE IF NOT EXISTS dias_semana (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(20) NOT NULL UNIQUE
    )`);

    // 10. Relación Rutina-Días
    await db.query(`CREATE TABLE IF NOT EXISTS rutina_dias (
      rutina_id INT NOT NULL,
      dia_id INT NOT NULL,
      PRIMARY KEY (rutina_id, dia_id),
      FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE,
      FOREIGN KEY (dia_id) REFERENCES dias_semana(id) ON DELETE CASCADE
    )`);

    // 11. Rutina Ejercicio Series
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

    // Inserciones de datos iniciales ignorando duplicados
    await db.query(`INSERT IGNORE INTO musculos (nombre) VALUES
      ('Pectoral'), ('Bíceps'), ('Tríceps'), ('Hombro'), ('Espalda'),
      ('Pierna'), ('Glúteo'), ('Abdomen'), ('Todo el cuerpo'), ('Cardio')`);

    await db.query(`INSERT IGNORE INTO dias_semana (nombre) VALUES
      ('Lunes'), ('Martes'), ('Miércoles'), ('Jueves'), ('Viernes'), ('Sábado'), ('Domingo')`);

    await db.query(`INSERT IGNORE INTO ejercicios (id, nombre, descripcion, imagen_url, video_url) VALUES
      (1, 'Curl de bíceps con barra Z', 'Ejercicio para trabajar la cabeza larga y corta del bíceps.', 'https://cloudinary.com', ''),
      (2, 'Press banca', 'Ejercicio básico de pecho, trabaja pectoral mayor y menor, además de tríceps y deltoides anterior.', 'https://cloudinary.com', '')`);

    console.log('🎉 ¡Todas las tablas y datos de FitLover inicializados con éxito!');
  } catch (error) {
    console.error('❌ Error inicializando las tablas deportivas:', error.message);
  }
}

inicializarTablas();
