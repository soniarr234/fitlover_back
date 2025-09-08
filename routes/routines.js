// backend/routes/routines.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');

// Crear rutina
router.post('/', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  const { nombre, descripcion, tipo, dias } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO rutinas (usuario_id, nombre, descripcion, tipo) VALUES (?, ?, ?, ?)',
      [usuario_id, nombre, descripcion || null, tipo || '']
    );
    const rutinaId = result.insertId;

    // Insertar días de la semana
    if (dias && dias.length > 0) {
      const values = dias.map(diaId => [rutinaId, diaId]);
      await db.query('INSERT INTO rutina_dias (rutina_id, dia_id) VALUES ?', [values]);
    }
    // Traer los nombres de los días
    let diasNombres = [];
    if (dias && dias.length > 0) {
      const [rows] = await db.query(
        'SELECT nombre FROM dias_semana WHERE id IN (?)',
        [dias]
      );
      diasNombres = rows.map(r => r.nombre);
    }

    res.json({ id: result.insertId, nombre, descripcion, tipo, dias });
  } catch (err) {
    console.error(err);
    // Detectar error de duplicado
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Ya tienes una rutina con ese nombre' });
    }
    res.status(500).json({ message: 'Error al crear rutina', error: err.message });
  }
});

// Obtener rutinas del usuario
router.get('/', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.nombre, r.descripcion, r.tipo,
              GROUP_CONCAT(d.nombre ORDER BY d.id) AS dias
       FROM rutinas r
       LEFT JOIN rutina_dias rd ON r.id = rd.rutina_id
       LEFT JOIN dias_semana d ON rd.dia_id = d.id
       WHERE r.usuario_id = ?
       GROUP BY r.id`,
      [usuario_id]
    );

    // Convertir dias de string a array
    const rutinas = rows.map(r => ({
      ...r,
      dias: r.dias ? r.dias.split(',') : []
    }));

    res.json(rutinas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener rutinas', error: err.message });
  }
});

// Borrar rutina
router.delete('/:id', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  const { id } = req.params;
  try {
    const [result] = await db.query(
      'DELETE FROM rutinas WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Rutina no encontrada' });
    res.json({ message: 'Rutina eliminada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar rutina', error: err.message });
  }
});

// Añadir ejercicio a rutina
router.post('/:id/ejercicios', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  const { id } = req.params; // rutina_id
  const { ejercicio_id, notas } = req.body;

  try {
    const [rutina] = await db.query(
      'SELECT id FROM rutinas WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    if (rutina.length === 0) return res.status(403).json({ message: 'No autorizado' });

    const [exists] = await db.query(
      'SELECT * FROM rutina_ejercicios WHERE rutina_id = ? AND ejercicio_id = ?',
      [id, ejercicio_id]
    );
    if (exists.length > 0) {
      return res.status(400).json({ message: 'El ejercicio ya está en esta rutina' });
    }

    await db.query(
      'INSERT INTO rutina_ejercicios (rutina_id, ejercicio_id, notas) VALUES (?, ?, ?)',
      [id, ejercicio_id, notas || null]
    );

    res.json({ message: 'Ejercicio añadido a la rutina' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al añadir ejercicio a rutina', error: err.message });
  }
});

// Quitar ejercicio de rutina
router.delete('/:id/ejercicios/:ejercicioId', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  const { id, ejercicioId } = req.params;

  try {
    const [rutina] = await db.query(
      'SELECT id FROM rutinas WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    if (rutina.length === 0) return res.status(403).json({ message: 'No autorizado' });

    const [result] = await db.query(
      'DELETE FROM rutina_ejercicios WHERE rutina_id = ? AND ejercicio_id = ?',
      [id, ejercicioId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Ejercicio no encontrado en rutina' });

    res.json({ message: 'Ejercicio eliminado de la rutina' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar ejercicio de rutina', error: err.message });
  }
});

// Obtener ejercicios de una rutina
router.get('/:id/ejercicios', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  const { id } = req.params;

  try {
    const [rutina] = await db.query(
      'SELECT id FROM rutinas WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    if (rutina.length === 0) return res.status(403).json({ message: 'No autorizado' });

    const [rows] = await db.query(
      `SELECT e.*,
        IFNULL(
          (SELECT JSON_ARRAYAGG(a.nota)
          FROM anotaciones a
          WHERE a.ejercicio_id = e.id AND a.usuario_id = ?), JSON_ARRAY()
        ) AS anotaciones,
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
        ) AS partes
      FROM rutina_ejercicios re
      JOIN ejercicios e ON e.id = re.ejercicio_id
      WHERE re.rutina_id = ?
      `,
      [usuario_id, id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener ejercicios de rutina', error: err.message });
  }
});

// Editar rutina
router.put('/:id', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  const { id } = req.params;
  const { nombre, descripcion, tipo, dias } = req.body;

  try {
    // Actualizar rutina principal
    const [result] = await db.query(
      'UPDATE rutinas SET nombre = ?, descripcion = ?, tipo = ? WHERE id = ? AND usuario_id = ?',
      [nombre, descripcion || null, tipo || '', id, usuario_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Rutina no encontrada' });

    // Borrar días antiguos
    await db.query('DELETE FROM rutina_dias WHERE rutina_id = ?', [id]);

    // Insertar nuevos días
    if (dias && dias.length > 0) {
      const values = dias.map(diaId => [id, diaId]);
      await db.query('INSERT INTO rutina_dias (rutina_id, dia_id) VALUES ?', [values]);
    }

    // Recuperar rutina actualizada con nombres de días
    const [rows] = await db.query(
      `SELECT r.id, r.nombre, r.descripcion, r.tipo,
              GROUP_CONCAT(d.nombre ORDER BY d.id) AS dias
       FROM rutinas r
       LEFT JOIN rutina_dias rd ON r.id = rd.rutina_id
       LEFT JOIN dias_semana d ON rd.dia_id = d.id
       WHERE r.id = ? AND r.usuario_id = ?
       GROUP BY r.id`,
      [id, usuario_id]
    );

    const rutina = rows[0];
    rutina.dias = rutina.dias ? rutina.dias.split(',') : [];

    res.json(rutina);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al editar rutina', error: err.message });
  }
});

// Obtener rutina individual
router.get('/:id', verifyToken, async (req, res) => {
  const usuario_id = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT r.id, r.nombre, r.descripcion, r.tipo,
              GROUP_CONCAT(d.nombre ORDER BY d.id) AS dias
       FROM rutinas r
       LEFT JOIN rutina_dias rd ON r.id = rd.rutina_id
       LEFT JOIN dias_semana d ON rd.dia_id = d.id
       WHERE r.id = ? AND r.usuario_id = ?
       GROUP BY r.id`,
      [id, usuario_id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Rutina no encontrada' });

    const rutina = rows[0];
    rutina.dias = rutina.dias ? rutina.dias.split(',') : [];

    res.json(rutina);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener rutina', error: err.message });
  }
});

// GET /api/routines/:rutinaId/ejercicios/:ejercicioId/series?dia=Lunes
router.get('/:rutinaId/ejercicios/:ejercicioId/series', verifyToken, async (req, res) => {
    const usuario_id = req.user.id;
    const { rutinaId, ejercicioId } = req.params;
    const { dia } = req.query;

    if (!dia) return res.status(400).json({ message: 'Falta parámetro dia' });

    try {
        const [day] = await db.query('SELECT id FROM dias_semana WHERE nombre = ?', [dia]);
        if (!day.length) return res.status(400).json({ message: 'Día inválido' });
        const diaId = day[0].id;

        // validar existencia y propiedad en una query
        const [rows] = await db.query(`
            SELECT res.serie_num, res.repeticiones, res.peso
            FROM rutina_ejercicios re
            JOIN rutinas r ON r.id = re.rutina_id
            LEFT JOIN rutina_ejercicio_series res ON res.rutina_ejercicio_id = re.id AND res.dia_id = ?
            WHERE re.rutina_id = ? AND re.ejercicio_id = ? AND r.usuario_id = ?
            ORDER BY res.serie_num
        `, [diaId, rutinaId, ejercicioId, usuario_id]);

        // rows puede contener filas con null si no hay series; filtramos
        const series = rows.filter(r => r.serie_num !== null);

        res.json(series);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener series', error: err.message });
    }
});


// POST /api/routines/:rutinaId/ejercicios/:ejercicioId/series
router.post('/:rutinaId/ejercicios/:ejercicioId/series', verifyToken, async (req, res) => {
    const usuario_id = req.user.id;
    const { rutinaId, ejercicioId } = req.params;
    const { dia, series } = req.body; // series = [{ repeticiones: 10, peso: 5 }, ...]

    if (!dia || !Array.isArray(series) || series.length === 0)
        return res.status(400).json({ message: 'Faltan datos o series vacías' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // obtener id del día
        const [day] = await connection.query('SELECT id FROM dias_semana WHERE nombre = ?', [dia]);
        if (!day.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'Día inválido' });
        }
        const diaId = day[0].id;

        // validar que la rutina pertenece al usuario y que el ejercicio esté en la rutina
        const [rows] = await connection.query(`
            SELECT re.id AS rutina_ejercicio_id
            FROM rutina_ejercicios re
            JOIN rutinas r ON r.id = re.rutina_id
            WHERE re.rutina_id = ? AND re.ejercicio_id = ? AND r.usuario_id = ?
            LIMIT 1
        `, [rutinaId, ejercicioId, usuario_id]);

        if (!rows.length) {
            await connection.rollback();
            return res.status(403).json({ message: 'No autorizado o ejercicio no encontrado en la rutina' });
        }

        const rutina_ejercicio_id = rows[0].rutina_ejercicio_id;

        // obtener el último número de serie existente para ese día
        const [existing] = await connection.query(
            'SELECT MAX(serie_num) AS maxSerie FROM rutina_ejercicio_series WHERE rutina_ejercicio_id = ? AND dia_id = ?',
            [rutina_ejercicio_id, diaId]
        );
        let nextSerieNum = existing[0].maxSerie ? existing[0].maxSerie + 1 : 1;

        // preparar inserción
        const inserts = [];
        for (const s of series) {
            if (typeof s.repeticiones !== 'number' || (s.peso !== undefined && typeof s.peso !== 'number')) {
                await connection.rollback();
                return res.status(400).json({ message: 'Formato de series inválido' });
            }
            inserts.push([rutina_ejercicio_id, diaId, nextSerieNum, s.repeticiones, s.peso || 0]);
            nextSerieNum++;
        }

        if (inserts.length > 0) {
            await connection.query(
                'INSERT INTO rutina_ejercicio_series (rutina_ejercicio_id, dia_id, serie_num, repeticiones, peso) VALUES ?',
                [inserts]
            );
        }

        // traer series actualizadas para devolver
        const [saved] = await connection.query(
            `SELECT serie_num, repeticiones, peso
             FROM rutina_ejercicio_series
             WHERE rutina_ejercicio_id = ? AND dia_id = ?
             ORDER BY serie_num`,
            [rutina_ejercicio_id, diaId]
        );

        await connection.commit();
        res.json({ message: 'Series guardadas correctamente', dia, series: saved });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Error al guardar series', error: err.message });
    } finally {
        connection.release();
    }
});

// DELETE /api/routines/:rutinaId/ejercicios/:ejercicioId/series/:serieNum?dia=Lunes
router.delete('/:rutinaId/ejercicios/:ejercicioId/series/:serieNum', verifyToken, async (req, res) => {
    const usuario_id = req.user.id;
    const { rutinaId, ejercicioId, serieNum } = req.params;
    const { dia } = req.query;

    if (!dia) return res.status(400).json({ message: 'Falta parámetro dia' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [day] = await connection.query('SELECT id FROM dias_semana WHERE nombre = ?', [dia]);
        if (!day.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'Día inválido' });
        }
        const diaId = day[0].id;

        const [rows] = await connection.query(`
            SELECT re.id AS rutina_ejercicio_id
            FROM rutina_ejercicios re
            JOIN rutinas r ON r.id = re.rutina_id
            WHERE re.rutina_id = ? AND re.ejercicio_id = ? AND r.usuario_id = ?
            LIMIT 1
        `, [rutinaId, ejercicioId, usuario_id]);

        if (!rows.length) {
            await connection.rollback();
            return res.status(403).json({ message: 'No autorizado o ejercicio no encontrado en la rutina' });
        }

        const rutina_ejercicio_id = rows[0].rutina_ejercicio_id;

        await connection.query(
            'DELETE FROM rutina_ejercicio_series WHERE rutina_ejercicio_id = ? AND dia_id = ? AND serie_num = ?',
            [rutina_ejercicio_id, diaId, serieNum]
        );

        await connection.commit();
        res.json({ message: `Serie ${serieNum} eliminada correctamente`, dia });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar serie', error: err.message });
    } finally {
        connection.release();
    }
});

// PUT /api/routines/:rutinaId/ejercicios/:ejercicioId/series/:serieNum
router.put('/:rutinaId/ejercicios/:ejercicioId/series/:serieNum', verifyToken, async (req, res) => {
    const usuario_id = req.user.id;
    const { rutinaId, ejercicioId, serieNum } = req.params;
    const { dia, repeticiones, peso } = req.body;

    if (!dia) return res.status(400).json({ message: 'Falta parámetro dia' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // validar día
        const [day] = await connection.query('SELECT id FROM dias_semana WHERE nombre = ?', [dia]);
        if (!day.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'Día inválido' });
        }
        const diaId = day[0].id;

        // validar que el ejercicio pertenece a la rutina del usuario
        const [rows] = await connection.query(`
            SELECT re.id AS rutina_ejercicio_id
            FROM rutina_ejercicios re
            JOIN rutinas r ON r.id = re.rutina_id
            WHERE re.rutina_id = ? AND re.ejercicio_id = ? AND r.usuario_id = ?
            LIMIT 1
        `, [rutinaId, ejercicioId, usuario_id]);

        if (!rows.length) {
            await connection.rollback();
            return res.status(403).json({ message: 'No autorizado o ejercicio no encontrado en la rutina' });
        }

        const rutina_ejercicio_id = rows[0].rutina_ejercicio_id;

        // actualizar la serie
        const [result] = await connection.query(
            `UPDATE rutina_ejercicio_series
             SET repeticiones = ?, peso = ?
             WHERE rutina_ejercicio_id = ? AND dia_id = ? AND serie_num = ?`,
            [repeticiones, peso, rutina_ejercicio_id, diaId, serieNum]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Serie no encontrada' });
        }

        // traer series actualizadas
        const [updated] = await connection.query(
            `SELECT serie_num, repeticiones, peso
             FROM rutina_ejercicio_series
             WHERE rutina_ejercicio_id = ? AND dia_id = ?
             ORDER BY serie_num`,
            [rutina_ejercicio_id, diaId]
        );

        await connection.commit();
        res.json({ message: 'Serie actualizada correctamente', dia, series: updated });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar serie', error: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;