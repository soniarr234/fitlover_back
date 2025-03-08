const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

/*
// Crear un pool de conexiones para despliegue
const pool = mysql.createPool({
    host: process.env.MYSQL_ADDON_HOST,
    user: process.env.MYSQL_ADDON_USER,
    password: process.env.MYSQL_ADDON_PASSWORD,
    database: process.env.MYSQL_ADDON_DB,
    port: process.env.MYSQL_ADDON_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});
*/

// Crear un pool de conexiones para produccion
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.MYSQL_ADDON_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});


// Función para manejar errores de conexión
pool.on('error', (err) => {
    console.error('Error en la conexión con la base de datos:', err);
});

// Ruta para mantener vivo el backend en Render
app.get('/ping', (req, res) => {
    res.send('pong');
});


//_____________________________________________________________________________________________________
                                            //LOGIN Y REGISTRO
//_____________________________________________________________________________________________________
// Ruta para registrar un usuario
app.post('/register', async (req, res) => {
    const { nombre, apellidos, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
        const [result] = await pool.promise().query(
            'INSERT INTO usuarios (nombre, apellidos, email, password_hash) VALUES (?, ?, ?, ?)',
            [nombre, apellidos, email, hashedPassword]
        );
        res.json({ message: 'Usuario registrado' });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Ruta para iniciar sesión
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.promise().query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );

        if (users.length === 0) return res.status(401).json({ message: 'Usuario no encontrado' });

        const isValid = await bcrypt.compare(password, users[0].password_hash);
        if (!isValid) return res.status(401).json({ message: 'Contraseña incorrecta' });

        const token = jwt.sign(
            { id: users[0].id, nombre: users[0].nombre, email: users[0].email },
            'secreto',
        );

        res.json({ token, nombre: users[0].nombre, email: users[0].email });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Ruta para obtener el usuario autenticado
app.get('/usuario', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        const decoded = jwt.verify(token, 'secreto');

        const [results] = await pool.promise().query(
            'SELECT id, nombre, apellidos, email FROM usuarios WHERE id = ?',
            [decoded.id]
        );

        if (results.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });

        res.json(results[0]); // Enviar el objeto completo incluyendo el ID
    } catch (error) {
        console.error("Error al obtener el usuario:", error);
        res.status(500).json({ message: "Error al obtener el usuario" });
    }
});

//_____________________________________________________________________________________________________
                                            //EJERCICIOS
//_____________________________________________________________________________________________________
// Ruta para obtener todos los ejercicios
app.get('/ejercicios', async (req, res) => {
    try {
        const [results] = await pool.promise().query('SELECT * FROM ejercicios');

        // Convertir el campo 'musculos' de string a array
        const ejercicios = results.map(ejercicio => ({
            ...ejercicio,
            musculos: ejercicio.musculos ? ejercicio.musculos.split(',') : []
        }));

        res.json(ejercicios);
    } catch (err) {
        console.error('Error al obtener ejercicios:', err);
        res.status(500).json(err);
    }
});

// Ruta para agregar un ejercicio
app.post('/ejercicios', async (req, res) => {
    let { nombre, musculos, descripcion, observaciones, video_o_imagen_url } = req.body;

    try {
        // Convertir array a string separado por comas (Ej: "Pecho,Bíceps")
        musculos = Array.isArray(musculos) ? musculos.join(',') : musculos;

        const [result] = await pool.promise().query(
            'INSERT INTO ejercicios (nombre, musculos, descripcion, observaciones, video_o_imagen_url) VALUES (?, ?, ?, ?, ?)',
            [nombre, musculos, descripcion, observaciones, video_o_imagen_url]
        );

        res.status(201).json({ message: 'Ejercicio creado con éxito', id: result.insertId });
    } catch (error) {
        console.error('Error al insertar en la base de datos:', error);
        res.status(500).json({ message: 'Error al crear el ejercicio' });
    }
});

// Ruta para actualizar las observaciones de un ejercicio
app.put('/ejercicios/:id', async (req, res) => {
    const { id } = req.params;
    const { observaciones } = req.body;

    try {
        const [result] = await pool.promise().query(
            'UPDATE ejercicios SET observaciones = ? WHERE id = ?',
            [observaciones, id]
        );

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Observaciones actualizadas con éxito' });
        } else {
            res.status(404).json({ message: 'Ejercicio no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar las observaciones' });
    }
});

// Ruta para eliminar un ejercicio
app.delete('/ejercicios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.promise().query(
            'DELETE FROM ejercicios WHERE id = ?',
            [id]
        );

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Ejercicio eliminado con éxito' });
        } else {
            res.status(404).json({ message: 'Ejercicio no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el ejercicio' });
    }
});


//_____________________________________________________________________________________________________
                                            //RUTINAS
//_____________________________________________________________________________________________________
// Ruta para crear una rutina
app.post('/rutinas', async (req, res) => {
    const { nombre } = req.body;
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        const decoded = jwt.verify(token, 'secreto');

        // Verificar si ya existe una rutina con el mismo nombre
        const [existingRoutine] = await pool.promise().query(
            'SELECT * FROM rutinas WHERE nombre = ? AND usuario_id = ?',
            [nombre, decoded.id]
        );

        if (existingRoutine.length > 0) {
            return res.status(400).json({ message: "Ya existe una rutina con ese nombre" });
        }

        // Crear la nueva rutina
        const [result] = await pool.promise().query(
            'INSERT INTO rutinas (nombre, usuario_id) VALUES (?, ?)',
            [nombre, decoded.id]
        );

        res.status(201).json({ message: "Rutina creada con éxito", id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: "Error al crear la rutina" });
    }
});


// Ruta para obtener todas las rutinas del usuario autenticado
app.get('/rutinas', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        const decoded = jwt.verify(token, 'secreto');
        const [results] = await pool.promise().query(
            'SELECT * FROM rutinas WHERE usuario_id = ?',
            [decoded.id]
        );

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener las rutinas" });
    }
});

// Ruta para eliminar una rutina
app.delete('/rutinas/:id', async (req, res) => {
    const { id } = req.params;  // Obtenemos el ID de la rutina desde la URL
    const token = req.headers.authorization?.split(" ")[1];  // Verificamos el token de autenticación

    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        const decoded = jwt.verify(token, 'secreto');  // Verificamos el token

        // Verificamos si la rutina existe y pertenece al usuario autenticado
        const [results] = await pool.promise().query(
            'SELECT * FROM rutinas WHERE id = ? AND usuario_id = ?',
            [id, decoded.id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'Rutina no encontrada o no pertenece al usuario' });
        }

        // Procedemos a eliminar la rutina
        await pool.promise().query('DELETE FROM rutinas WHERE id = ?', [id]);

        res.status(200).json({ message: 'Rutina eliminada con éxito' });

    } catch (error) {
        console.error("Error al eliminar la rutina:", error);
        res.status(500).json({ message: "Error al eliminar la rutina" });
    }
});

// Ruta para actualizar el orden de las rutinas
app.put('/rutinas/updateOrder', async (req, res) => {
    const { order } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: 'No autorizado' });

    try {
        const decoded = jwt.verify(token, 'secreto');
        for (let i = 0; i < order.length; i++) {
            await pool.promise().query(
                'UPDATE rutinas SET orden = ? WHERE id = ? AND usuario_id = ?',
                [i + 1, order[i], decoded.id]
            );
        }
        res.status(200).json({ message: 'Orden actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el orden de las rutinas' });
    }
});

//_____________________________________________________________________________________________________
                                            //EJERCICIOS EN RUTINAS
//_____________________________________________________________________________________________________
// Ruta para añadir un ejercicio a una rutina
app.post('/rutina_ejercicios', async (req, res) => {
    const { rutina_id, ejercicio_id } = req.body; // ID de la rutina y ejercicio
    const token = req.headers.authorization?.split(" ")[1]; // Autenticación con JWT

    // Si no hay token, retorna un error 401
    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        // Verifica el usuario autenticado
        const decoded = jwt.verify(token, 'secreto');
        const usuario_id = decoded.id;

        // Comprobar si el ejercicio ya está en la rutina
        const [rows] = await pool.promise().query(
            'SELECT * FROM rutina_ejercicios WHERE rutina_id = ? AND ejercicio_id = ?',
            [rutina_id, ejercicio_id]
        );

        // Si ya existe el ejercicio en la rutina, devolver un error
        if (rows.length > 0) {
            return res.status(400).json({ message: 'Este ejercicio ya está en la rutina' });
        }

         // Obtener el último valor de orden para esa rutina (si existe alguno)
         const [maxOrdenRow] = await pool.promise().query(
            'SELECT MAX(orden) AS maxOrden FROM rutina_ejercicios WHERE rutina_id = ?',
            [rutina_id]
        );

        const nuevoOrden = maxOrdenRow[0].maxOrden ? maxOrdenRow[0].maxOrden + 1 : 1; // Si no hay ejercicios, empieza desde 1

        // Insertar el ejercicio en la tabla de rutina_ejercicios
        await pool.promise().query(
            'INSERT INTO rutina_ejercicios (rutina_id, ejercicio_id, usuario_id, orden) VALUES (?, ?, ?, ?)',
            [rutina_id, ejercicio_id, usuario_id, nuevoOrden]
        );

        res.status(201).json({ message: 'Ejercicio añadido a la rutina con éxito' });
    } catch (error) {
        console.error("Error al agregar el ejercicio:", error);
        res.status(500).json({ message: "Error al agregar el ejercicio a la rutina" });
    }
});

// Ruta para eliminar un ejercicio de una rutina
app.delete('/rutina_ejercicios', async (req, res) => {
    const { rutina_id, ejercicio_id } = req.body; // ID de la rutina y ejercicio
    const token = req.headers.authorization?.split(" ")[1]; // Autenticación con JWT

    // Si no hay token, retorna un error 401
    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        // Verifica el usuario autenticado
        const decoded = jwt.verify(token, 'secreto');
        const usuario_id = decoded.id;

        // Verifica si el ejercicio está en la rutina
        const [rows] = await pool.promise().query(
            'SELECT * FROM rutina_ejercicios WHERE rutina_id = ? AND ejercicio_id = ? AND usuario_id = ?',
            [rutina_id, ejercicio_id, usuario_id]
        );

        // Si no se encuentra el ejercicio, devolver un error
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Ejercicio no encontrado en la rutina' });
        }

        // Eliminar el ejercicio de la rutina
        await pool.promise().query(
            'DELETE FROM rutina_ejercicios WHERE rutina_id = ? AND ejercicio_id = ? AND usuario_id = ?',
            [rutina_id, ejercicio_id, usuario_id]
        );

        res.status(200).json({ message: 'Ejercicio eliminado de la rutina con éxito' });
    } catch (error) {
        console.error("Error al eliminar el ejercicio:", error);
        res.status(500).json({ message: "Error al eliminar el ejercicio de la rutina" });
    }
});

app.get('/rutina_ejercicios', async (req, res) => {
    const usuarioId = req.user.id;  // Suponiendo que tienes la validación de usuario mediante JWT o algo similar.
    const rutinaId = req.query.rutina_id;

    try {
        // Obtener los ejercicios asociados a una rutina y un usuario
        const resultado = await db.query(
            `SELECT re.id, e.nombre, e.musculos, e.descripcion, e.video_o_imagen_url
            FROM rutina_ejercicios re
            JOIN ejercicios e ON e.id = re.ejercicio_id
            WHERE re.rutina_id = ? AND re.usuario_id = ?`,
            [rutinaId, usuarioId]
        );

        res.json(resultado);
    } catch (error) {
        console.error('Error al obtener los ejercicios de la rutina:', error);
        res.status(500).json({ message: 'Error al obtener los ejercicios.' });
    }
});


app.get('/rutina_ejercicios/:rutina_id', async (req, res) => {
    const { rutina_id } = req.params;

    try {
        // Obtener los ejercicios asociados a una rutina y un usuario, ordenados por el campo 'orden'
        const [results] = await pool.promise().query(
            `SELECT e.*, re.orden
            FROM ejercicios e
            INNER JOIN rutina_ejercicios re ON e.id = re.ejercicio_id
            WHERE re.rutina_id = ?
            ORDER BY re.orden`,
            [rutina_id]
        );

        res.json(results); // Devuelve los ejercicios de la rutina, ordenados por 'orden'
    } catch (error) {
        console.error("Error al obtener los ejercicios de la rutina:", error);
        res.status(500).json({ message: "Error al obtener los ejercicios." });
    }
});

// Ruta para actualizar el orden de los ejercicios en una rutina
app.put('/rutina_ejercicios/orden', async (req, res) => {
    const { rutina_id, ejercicios } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No autorizado" });
    }
    const token = authHeader.split(" ")[1]; 
    
    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        if (!rutina_id || !Array.isArray(ejercicios)) {
            console.log("❌ [BACK] Datos inválidos recibidos.");
            return res.status(400).json({ error: 'Datos inválidos' });
        }

        for (let ejercicio of ejercicios) {
            await pool.promise().query(
                'UPDATE rutina_ejercicios SET orden = ? WHERE rutina_id = ? AND ejercicio_id = ?', 
                [ejercicio.orden, rutina_id, ejercicio.id]
            );
        }        

        return res.status(200).json({ message: 'Orden de ejercicios actualizado correctamente' });

    } catch (error) {
        console.error("🔥 [BACK] Error al actualizar el orden de los ejercicios:", error);
        return res.status(500).json({ error: 'Hubo un problema al actualizar el orden de los ejercicios' });
    }
});





app.get('/rutinas/:id', async (req, res) => {
    const { id } = req.params;
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        const decoded = jwt.verify(token, 'secreto');
        const usuario_id = decoded.id;

        pool.query('SELECT * FROM rutinas WHERE id = ? AND usuario_id = ?', [id, usuario_id], (err, results) => {
            if (err) return res.status(500).json({ message: 'Error al obtener la rutina' });
            if (results.length === 0) return res.status(404).json({ message: 'Rutina no encontrada' });
            res.json(results[0]); // Devuelve la rutina con ese ID
        });

    } catch (error) {
        console.error("Error al obtener la rutina:", error);
        res.status(500).json({ message: "Error al obtener la rutina" });
    }
});

setInterval(() => {
    fetch("https://fitlover-back.onrender.com/ping")
      .then(() => console.log("Manteniendo vivo el backend"))
      .catch((err) => console.error("Error en el keep-alive", err));
  }, 20 * 60 * 1000); // Cada 20 minutos

// Iniciar el servidor
const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => console.log(`Backend corriendo en el puerto ${PORT}`));
