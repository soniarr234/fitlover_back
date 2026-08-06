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
    console.log('🗑️ Limpiando tablas antiguas para reconstruir la base de datos...');

    // Desactivar restricciones de llaves foráneas para poder borrar en orden
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Borrar tablas viejas si existen
    const tablas = [
      'rutina_ejercicio_series', 'rutina_dias', 'rutina_ejercicios', 'rutinas', 
      'anotaciones', 'ejercicio_partes', 'ejercicio_musculos', 'partes_musculo', 
      'musculos', 'dias_semana', 'ejercicios', 'usuarios'
    ];
    for (const tabla of tablas) {
      await db.query(`DROP TABLE IF EXISTS ${tabla}`);
    }
    
    // Volver a activar restricciones
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('🏗️ Creando nuevas tablas con la estructura limpia...');

    // 1. Usuarios (Utilizando password_hash adaptado a tu backend)
    await db.query(`CREATE TABLE usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      apellidos VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      resetToken VARCHAR(255),
      resetTokenExpires DATETIME
    )`);

    // 2. Ejercicios
    await db.query(`CREATE TABLE ejercicios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      imagen_url VARCHAR(255),
      video_url VARCHAR(255)
    )`);

    // 3. Músculos
    await db.query(`CREATE TABLE musculos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL UNIQUE
    )`);

    // 4. Partes de los músculos
    await db.query(`CREATE TABLE partes_musculo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      musculo_id INT NOT NULL,
      nombre VARCHAR(50) NOT NULL,
      FOREIGN KEY (musculo_id) REFERENCES musculos(id) ON DELETE CASCADE
    )`);

    // 5. Relación Ejercicio - Músculos
    await db.query(`CREATE TABLE ejercicio_musculos (
      ejercicio_id INT NOT NULL,
      musculo_id INT NOT NULL,
      PRIMARY KEY (ejercicio_id, musculo_id),
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      FOREIGN KEY (musculo_id) REFERENCES musculos(id) ON DELETE CASCADE
    )`);

    // 6. Relación Ejercicio - Partes de Músculo
    await db.query(`CREATE TABLE ejercicio_partes (
      ejercicio_id INT NOT NULL,
      parte_musculo_id INT NOT NULL,
      PRIMARY KEY (ejercicio_id, parte_musculo_id),
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      FOREIGN KEY (parte_musculo_id) REFERENCES partes_musculo(id) ON DELETE CASCADE
    )`);

    // 7. Anotaciones
    await db.query(`CREATE TABLE anotaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      ejercicio_id INT NOT NULL,
      nota TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE
    )`);

    // 8. Rutinas
    await db.query(`CREATE TABLE rutinas (
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
    await db.query(`CREATE TABLE rutina_ejercicios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rutina_id INT NOT NULL,
      ejercicio_id INT NOT NULL,
      notas TEXT,
      FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE,
      FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
      UNIQUE (rutina_id, ejercicio_id)
    )`);

    // 10. Días de la semana
    await db.query(`CREATE TABLE dias_semana (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(20) NOT NULL UNIQUE
    )`);

    // 11. Relación Rutina - Días
    await db.query(`CREATE TABLE rutina_dias (
      rutina_id INT NOT NULL,
      dia_id INT NOT NULL,
      PRIMARY KEY (rutina_id, dia_id),
      FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE,
      FOREIGN KEY (dia_id) REFERENCES dias_semana(id) ON DELETE CASCADE
    )`);

    // 12. Series de Ejercicios en Rutina
    await db.query(`CREATE TABLE rutina_ejercicio_series (
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

    console.log('🌱 Poblando los datos iniciales de FitLover...');

    // Inserción de Músculos Globales
    await db.query(`INSERT INTO musculos (nombre) VALUES
      ('Pectoral'), ('Bíceps'), ('Tríceps'), ('Hombro'), ('Espalda'),
      ('Pierna'), ('Glúteo'), ('Abdomen'), ('Todo el cuerpo'), ('Cardio')`);

    // Inserción de Días
    await db.query(`INSERT INTO dias_semana (nombre) VALUES
      ('Lunes'), ('Martes'), ('Miércoles'), ('Jueves'), ('Viernes'), ('Sábado'), ('Domingo')`);

    // Inserción de Partes Específicas de los Músculos
    await db.query(`INSERT INTO partes_musculo (musculo_id, nombre) VALUES
      ((SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1), 'Cabeza larga'),
      ((SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1), 'Cabeza corta'),
      ((SELECT id FROM musculos WHERE nombre = 'Tríceps' LIMIT 1), 'Cabeza larga'),
      ((SELECT id FROM musculos WHERE nombre = 'Tríceps' LIMIT 1), 'Cabeza medial'),
      ((SELECT id FROM musculos WHERE nombre = 'Tríceps' LIMIT 1), 'Cabeza lateral'),
      ((SELECT id FROM musculos WHERE nombre = 'Hombro' LIMIT 1), 'Deltoides anterior'),
      ((SELECT id FROM musculos WHERE nombre = 'Hombro' LIMIT 1), 'Deltoides lateral'),
      ((SELECT id FROM musculos WHERE nombre = 'Hombro' LIMIT 1), 'Deltoides posterior'),
      ((SELECT id FROM musculos WHERE nombre = 'Hombro' LIMIT 1), 'Manguito rotador'),
      ((SELECT id FROM musculos WHERE nombre = 'Pectoral' LIMIT 1), 'Pectoral superior'),
      ((SELECT id FROM musculos WHERE nombre = 'Pectoral' LIMIT 1), 'Pectoral medio'),
      ((SELECT id FROM musculos WHERE nombre = 'Pectoral' LIMIT 1), 'Pectoral inferior'),
      ((SELECT id FROM musculos WHERE nombre = 'Espalda' LIMIT 1), 'Dorsal ancho'),
      ((SELECT id FROM musculos WHERE nombre = 'Espalda' LIMIT 1), 'Trapecio'),
      ((SELECT id FROM musculos WHERE nombre = 'Pierna' LIMIT 1), 'Cuádriceps'),
      ((SELECT id FROM musculos WHERE nombre = 'Pierna' LIMIT 1), 'Isquiotibiales'),
      ((SELECT id FROM musculos WHERE nombre = 'Pierna' LIMIT 1), 'Aductores'),
      ((SELECT id FROM musculos WHERE nombre = 'Pierna' LIMIT 1), 'Abductores'),
      ((SELECT id FROM musculos WHERE nombre = 'Pierna' LIMIT 1), 'Gemelos'),
      ((SELECT id FROM musculos WHERE nombre = 'Glúteo' LIMIT 1), 'Glúteo mayor'),
      ((SELECT id FROM musculos WHERE nombre = 'Glúteo' LIMIT 1), 'Glúteo medio'),
      ((SELECT id FROM musculos WHERE nombre = 'Abdomen' LIMIT 1), 'Recto abdominal "six-pack"'),
      ((SELECT id FROM musculos WHERE nombre = 'Abdomen' LIMIT 1), 'Oblicuos externos'),
      ((SELECT id FROM musculos WHERE nombre = 'Abdomen' LIMIT 1), 'Oblicuos internos'),
      ((SELECT id FROM musculos WHERE nombre = 'Abdomen' LIMIT 1), 'Lumbares')`);

    // Inserción de Ejercicios Iniciales de ejemplo
    await db.query(`INSERT INTO ejercicios (id, nombre, descripcion, imagen_url, video_url) VALUES
      (1, 'Curl de bíceps con barra Z', 'Ejercicio para trabajar la cabeza larga y corta del bíceps.', 'https://cloudinary.com', ''),
      (2, 'Press banca', 'Ejercicio básico de pecho, trabaja pectoral mayor y menor, además de tríceps y deltoides anterior.', 'https://cloudinary.com', '')`);

    // Inserción de Relaciones Ejercicio - Músculo
    await db.query(`INSERT INTO ejercicio_musculos (ejercicio_id, musculo_id) VALUES
      (1, (SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1)),
      (2, (SELECT id FROM musculos WHERE nombre = 'Pectoral' LIMIT 1)),
      (2, (SELECT id FROM musculos WHERE nombre = 'Tríceps' LIMIT 1)),
      (2, (SELECT id FROM musculos WHERE nombre = 'Hombro' LIMIT 1))`);

    // Inserción de Relaciones Ejercicio - Partes de Músculo
    await db.query(`INSERT INTO ejercicio_partes (ejercicio_id, parte_musculo_id) VALUES
      (1, (SELECT id FROM partes_musculo WHERE nombre = 'Cabeza larga' AND musculo_id = (SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1) LIMIT 1)),
      (1, (SELECT id FROM partes_musculo WHERE nombre = 'Cabeza corta' AND musculo_id = (SELECT id FROM musculos WHERE nombre = 'Bíceps' LIMIT 1) LIMIT 1))`);

    console.log('🎉 ¡Base de datos FitLover reconstruida DE CERO con total éxito!');
  } catch (error) {
    console.error('❌ Error al reconstruir la base de datos:', error.message);
  }
}

inicializarTablas();
