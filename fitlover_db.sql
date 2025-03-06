CREATE DATABASE fitlover_database;
USE fitlover_database;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    apellidos VARCHAR(200),
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255)
);

CREATE TABLE ejercicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    musculos VARCHAR(255),
    descripcion TEXT,
    observaciones TEXT,
    video_o_imagen_url VARCHAR(255)
);

INSERT INTO ejercicios (nombre, musculos, descripcion, observaciones, video_o_imagen_url) VALUES 
('Press de Banca', 'Cardio', 'Ejercicio para pecho', '', 'https://res.cloudinary.com/dkicsjbbb/image/upload/v1737725993/ejercicios-page-responsive2_qrhe6u.png'),
('Otro', 'Espalda, Pecho', 'Ejercicio para pecho', '', 'https://res.cloudinary.com/dkicsjbbb/image/upload/v1737725993/ejercicios-page-responsive2_qrhe6u.png');

CREATE TABLE rutinas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(255) NOT NULL,
    usuario_id INT NOT NULL,
    orden INT DEFAULT 0,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE rutina_ejercicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rutina_id INT NOT NULL,
    ejercicio_id INT NOT NULL,
    usuario_id INT NOT NULL,
    orden INT DEFAULT 0,
    FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE,
    FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE ejercicio_series (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rutina_ejercicio_id INT NOT NULL,  -- Relacionado con la tabla rutina_ejercicios
    repeticiones INT NOT NULL,
    peso DECIMAL(5,2) NOT NULL,        -- Peso o tiempo si es cardio
    vueltas INT,                       -- Solo para cardio
    tiempo INT,                        -- Solo para cardio
    FOREIGN KEY (rutina_ejercicio_id) REFERENCES rutina_ejercicios(id) ON DELETE CASCADE
<<<<<<< HEAD
);
=======
);
>>>>>>> 2d4ed8c3a833270f76de6e74370cc2f71b3c5adf
