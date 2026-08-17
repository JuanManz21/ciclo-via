const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.use(authenticate, requireRole('admin', 'coordinator'));

router.get('/', (req, res) => {
  const { estudiante_id, fecha_inicio, fecha_fin } = req.query;

  let sql = `
    SELECT a.*, u.nombre as estudiante_nombre, u.documento as estudiante_documento, u.institucion
    FROM asistencia a
    JOIN users u ON a.estudiante_id = u.id
    WHERE u.role = 'student'
  `;
  const params = [];

  if (req.user.role === 'coordinator') {
    sql += ` AND u.institucion = ?`;
    params.push(req.user.institucion);
  }

  if (estudiante_id) {
    sql += ` AND a.estudiante_id = ?`;
    params.push(Number(estudiante_id));
  }
  if (fecha_inicio) {
    sql += ` AND a.fecha >= ?`;
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    sql += ` AND a.fecha <= ?`;
    params.push(fecha_fin);
  }

  sql += ` ORDER BY a.fecha DESC, u.nombre ASC`;

  const records = db.prepare(sql).all(...params);
  res.json(records);
});

router.post('/', requireRole('admin'), [
  body('estudiante_id').isInt().withMessage('ID de estudiante requerido'),
  body('fecha').notEmpty().withMessage('La fecha es requerida'),
  body('horas').isNumeric().withMessage('Las horas deben ser numéricas'),
  body('observacion').optional().isString()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { estudiante_id, fecha, horas, observacion } = req.body;

  const student = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(Number(estudiante_id), 'student');
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  if (!Number.isInteger(horas) || horas <= 0) {
    return res.status(400).json({ error: 'Las horas deben ser un número entero positivo' });
  }

  const result = db.prepare(
    'INSERT INTO asistencia (estudiante_id, fecha, horas, observacion) VALUES (?, ?, ?, ?)'
  ).run(Number(estudiante_id), fecha, horas, observacion || '');

  const newHoras = student.horas_completadas + horas;
  const updateHoras = Math.min(newHoras, student.horas_totales);

  db.prepare(
    'UPDATE users SET horas_completadas = ?, updated_at = datetime("now","localtime") WHERE id = ?'
  ).run(updateHoras, Number(estudiante_id));

  res.status(201).json({
    message: 'Asistencia registrada',
    asistencia: {
      id: result.lastInsertRowid,
      estudiante_id: Number(estudiante_id),
      fecha,
      horas,
      observacion: observacion || ''
    },
    horas_actualizadas: updateHoras
  });
});

router.delete('/:id', requireRole('admin'), [
  param('id').isInt()
], (req, res) => {
  const record = db.prepare(`
    SELECT a.*, u.horas_completadas FROM asistencia a
    JOIN users u ON a.estudiante_id = u.id
    WHERE a.id = ?
  `).get(Number(req.params.id));

  if (!record) {
    return res.status(404).json({ error: 'Registro de asistencia no encontrado' });
  }

  const newHoras = Math.max(0, record.horas_completadas - record.horas);
  db.prepare('UPDATE users SET horas_completadas = ?, updated_at = datetime("now","localtime") WHERE id = ?').run(newHoras, record.estudiante_id);
  db.prepare('DELETE FROM asistencia WHERE id = ?').run(Number(req.params.id));

  res.json({ message: 'Registro eliminado y horas ajustadas' });
});

module.exports = router;
