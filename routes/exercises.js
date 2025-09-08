// backend/routes/exercises.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');

// GET /api/exercises
router.get('/', verifyToken, async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const [rows] = await db.query(`
      SELECT 
        e.id,
        e.nombre,
        e.descripcion,
        e.imagen_url,
        e.video_url,
        IFNULL(
            (SELECT JSON_ARRAYAGG(m.nombre) 
            FROM musculos m
            JOIN ejercicio_musculos em ON em.musculo_id = m.id
            WHERE em.ejercicio_id = e.id), JSON_ARRAY()
        ) AS musculos,
        IFNULL(
            (SELECT JSON_ARRAYAGG(pm.nombre)
            FROM partes_musculo pm
            JOIN ejercicio_partes ep ON ep.parte_musculo_id = pm.id
            WHERE ep.ejercicio_id = e.id), JSON_ARRAY()
        ) AS partes,
        IFNULL((
            SELECT JSON_ARRAYAGG(a.nota)
            FROM anotaciones a
            WHERE a.ejercicio_id = e.id AND a.usuario_id = ?
        ), JSON_ARRAY()) AS anotaciones
        FROM ejercicios e
        ORDER BY e.nombre;
    `, [usuario_id]);

    res.json(rows);
    } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener ejercicios', error: err.message });
  }
});

// PUT /api/exercises/:id
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, imagen_url, musculos, partes, anotaciones } = req.body;
  const usuario_id = req.user.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar que el ejercicio existe
    const [ejercicioRows] = await connection.query('SELECT * FROM ejercicios WHERE id = ?', [id]);
    if (ejercicioRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Ejercicio no encontrado' });
    }

    const ejercicioActual = ejercicioRows[0];

    // Actualizar solo los campos que vienen en el body
    const updates = [];
    const params = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
    if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
    if (imagen_url !== undefined) { updates.push('imagen_url = ?'); params.push(imagen_url); }

    if (updates.length > 0) {
      await connection.query(
        `UPDATE ejercicios SET ${updates.join(', ')} WHERE id = ?`,
        [...params, id]
      );
    }

    // Actualizar músculos si vienen
    if (musculos !== undefined) {
      await connection.query('DELETE FROM ejercicio_musculos WHERE ejercicio_id = ?', [id]);
      for (let nombreMusculo of musculos) {
        const [rows] = await connection.query('SELECT id FROM musculos WHERE nombre = ?', [nombreMusculo]);
        let musculoId;
        if (rows.length) musculoId = rows[0].id;
        else {
          const [result] = await connection.query('INSERT INTO musculos (nombre) VALUES (?)', [nombreMusculo]);
          musculoId = result.insertId;
        }
        await connection.query('INSERT INTO ejercicio_musculos (ejercicio_id, musculo_id) VALUES (?, ?)', [id, musculoId]);
      }
    }

    // Actualizar partes si vienen
    if (partes !== undefined) {
      await connection.query('DELETE FROM ejercicio_partes WHERE ejercicio_id = ?', [id]);
      for (let nombreParte of partes) {
        const [rows] = await connection.query('SELECT id FROM partes_musculo WHERE nombre = ?', [nombreParte]);
        let parteId;
        if (rows.length) parteId = rows[0].id;
        else {
          const [result] = await connection.query('INSERT INTO partes_musculo (nombre) VALUES (?)', [nombreParte]);
          parteId = result.insertId;
        }
        await connection.query('INSERT INTO ejercicio_partes (ejercicio_id, parte_musculo_id) VALUES (?, ?)', [id, parteId]);
      }
    }

    // Actualizar anotaciones si vienen
    if (anotaciones !== undefined) {
      await connection.query('DELETE FROM anotaciones WHERE ejercicio_id = ? AND usuario_id = ?', [id, usuario_id]);
      for (let nota of anotaciones) {
        await connection.query(
          'INSERT INTO anotaciones (usuario_id, ejercicio_id, nota) VALUES (?, ?, ?)',
          [usuario_id, id, nota]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Ejercicio actualizado correctamente' });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar ejercicio', error: err.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM ejercicios WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' });
    }
    res.json({ message: 'Ejercicio eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar ejercicio' });
  }
});

//CREATE EXERCISE POST /api/exercises
router.post('/', verifyToken, async (req, res) => {
  const { nombre, descripcion, imagen_url, video_url, musculos = [], partes = [], anotaciones = [] } = req.body; // IDs
  const connection = await db.getConnection();
   const usuario_id = req.user.id;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO ejercicios (nombre, descripcion, imagen_url, video_url) VALUES (?, ?, ?, ?)',
      [nombre, descripcion, imagen_url, video_url]
    );
    const ejercicioId = result.insertId;

    // musculos: array de IDs
    for (const musculoId of musculos) {
      await connection.query(
        'INSERT INTO ejercicio_musculos (ejercicio_id, musculo_id) VALUES (?, ?)',
        [ejercicioId, musculoId]
      );
    }

    // partes: array de IDs (parte_musculo_id)
    for (const parteId of partes) {
      await connection.query(
        'INSERT INTO ejercicio_partes (ejercicio_id, parte_musculo_id) VALUES (?, ?)',
        [ejercicioId, parteId]
      );
    }

    // insertar anotaciones
    for (const nota of anotaciones) {
      await connection.query(
        'INSERT INTO anotaciones (usuario_id, ejercicio_id, nota) VALUES (?, ?, ?)',
        [usuario_id, ejercicioId, nota]
      );
    }

    await connection.commit();

    // Ahora devolvemos el ejercicio completo con nombres
    const [rows] = await connection.query(`
      SELECT 
        e.id,
        e.nombre,
        e.descripcion,
        e.imagen_url,
        e.video_url,
        IFNULL(
            (SELECT JSON_ARRAYAGG(m.nombre) 
            FROM musculos m
            JOIN ejercicio_musculos em ON em.musculo_id = m.id
            WHERE em.ejercicio_id = e.id), JSON_ARRAY()
        ) AS musculos,
        IFNULL(
            (SELECT JSON_ARRAYAGG(pm.nombre)
            FROM partes_musculo pm
            JOIN ejercicio_partes ep ON ep.parte_musculo_id = pm.id
            WHERE ep.ejercicio_id = e.id), JSON_ARRAY()
        ) AS partes,
        IFNULL((
            SELECT JSON_ARRAYAGG(a.nota)
            FROM anotaciones a
            WHERE a.ejercicio_id = e.id AND a.usuario_id = ?
        ), JSON_ARRAY()) AS anotaciones
      FROM ejercicios e
      WHERE e.id = ?
    `, [usuario_id, ejercicioId]);

    res.json(rows[0]);
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: 'Error al crear ejercicio', error: err.message });
  } finally {
    connection.release();
  }
});

// GET músculos
router.get('/muscles', verifyToken, async (req, res) => {
  const [rows] = await db.query('SELECT id, nombre FROM musculos ORDER BY nombre');
  res.json(rows);
});

// GET partes de músculos seleccionados
router.get('/muscle-parts', verifyToken, async (req, res) => {
  const ids = req.query.ids?.split(',') || [];
  if (ids.length === 0) return res.json([]);
  const [rows] = await db.query(
    `SELECT pm.id, pm.nombre, pm.musculo_id 
     FROM partes_musculo pm
     WHERE musculo_id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  res.json(rows);
});

// GET /api/exercises/filter
router.get('/filter', verifyToken, async (req, res) => {
    try {
        const usuario_id = req.user.id;
        const { musculos = '', partes = '' } = req.query;

        const musculosArray = musculos ? musculos.split(',') : [];
        const partesArray = partes ? partes.split(',') : [];

        let query = `
            SELECT 
                e.id,
                e.nombre,
                e.descripcion,
                e.imagen_url,
                e.video_url,
                IFNULL(
                    (SELECT JSON_ARRAYAGG(m.nombre) 
                     FROM musculos m
                     JOIN ejercicio_musculos em ON em.musculo_id = m.id
                     WHERE em.ejercicio_id = e.id), JSON_ARRAY()
                ) AS musculos,
                IFNULL(
                    (SELECT JSON_ARRAYAGG(pm.nombre)
                     FROM partes_musculo pm
                     JOIN ejercicio_partes ep ON ep.parte_musculo_id = pm.id
                     WHERE ep.ejercicio_id = e.id), JSON_ARRAY()
                ) AS partes,
                IFNULL((
                    SELECT JSON_ARRAYAGG(a.nota)
                    FROM anotaciones a
                    WHERE a.ejercicio_id = e.id AND a.usuario_id = ?
                ), JSON_ARRAY()) AS anotaciones
            FROM ejercicios e
        `;

        const conditions = [];
        const params = [usuario_id];

        if (musculosArray.length > 0) {
            conditions.push(`
                e.id IN (
                    SELECT ejercicio_id FROM ejercicio_musculos em
                    JOIN musculos m ON m.id = em.musculo_id
                    WHERE m.nombre IN (${musculosArray.map(() => '?').join(',')})
                )
            `);
            params.push(...musculosArray);
        }

        if (partesArray.length > 0) {
            conditions.push(`
                e.id IN (
                    SELECT ejercicio_id FROM ejercicio_partes ep
                    JOIN partes_musculo pm ON pm.id = ep.parte_musculo_id
                    WHERE pm.nombre IN (${partesArray.map(() => '?').join(',')})
                )
            `);
            params.push(...partesArray);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY e.nombre';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al filtrar ejercicios', error: err.message });
    }
});

module.exports = router;