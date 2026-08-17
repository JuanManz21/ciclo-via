const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.use(authenticate, requireRole('admin', 'coordinator'));

router.get('/', (req, res) => {
  let students;

  if (req.user.role === 'coordinator') {
    students = db.prepare(
      'SELECT id, documento, nombre, role, institucion, horas_completadas, horas_totales, created_at, updated_at FROM users WHERE role = ? AND institucion = ? ORDER BY nombre'
    ).all('student', req.user.institucion);
  } else {
    students = db.prepare(
      'SELECT id, documento, nombre, role, institucion, horas_completadas, horas_totales, created_at, updated_at FROM users WHERE role = ? ORDER BY nombre'
    ).all('student');
  }

  res.json(students);
});

router.get('/:id', [
  param('id').isInt()
], (req, res) => {
  const student = db.prepare(
    'SELECT id, documento, nombre, role, institucion, horas_completadas, horas_totales, created_at, updated_at FROM users WHERE id = ? AND role = ?'
  ).get(Number(req.params.id), 'student');

  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  if (req.user.role === 'coordinator' && student.institucion !== req.user.institucion) {
    return res.status(403).json({ error: 'No tienes acceso a este estudiante' });
  }

  res.json(student);
});

router.post('/', requireRole('admin'), [
  body('documento').notEmpty().withMessage('El documento es requerido'),
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('institucion').notEmpty().withMessage('La institución es requerida'),
  body('password').isLength({ min: 4 }).withMessage('La contraseña debe tener al menos 4 caracteres'),
  body('horas_totales').optional().isNumeric().withMessage('Las horas totales deben ser numéricas')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { documento, nombre, password, horas_totales, institucion } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE documento = ?').get(documento);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un registro con ese documento' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const horas = (horas_totales && Number.isInteger(horas_totales)) ? horas_totales : 480;

  const result = db.prepare(
    'INSERT INTO users (documento, nombre, password, role, institucion, horas_totales) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(documento, nombre, hashedPassword, 'student', institucion, horas);

  res.status(201).json({
    message: 'Estudiante creado exitosamente',
    student: {
      id: result.lastInsertRowid,
      documento,
      nombre,
      role: 'student',
      institucion,
      horas_completadas: 0,
      horas_totales: horas
    }
  });
});

router.post('/coordinator', requireRole('admin'), [
  body('documento').notEmpty().withMessage('El documento es requerido'),
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('institucion').notEmpty().withMessage('La institución es requerida'),
  body('password').isLength({ min: 4 }).withMessage('La contraseña debe tener al menos 4 caracteres')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { documento, nombre, password, institucion } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE documento = ?').get(documento);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un registro con ese documento' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const result = db.prepare(
    'INSERT INTO users (documento, nombre, password, role, institucion, horas_completadas, horas_totales) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(documento, nombre, hashedPassword, 'coordinator', institucion, 0, 0);

  res.status(201).json({
    message: 'Coordinador creado exitosamente',
    coordinator: {
      id: result.lastInsertRowid,
      documento,
      nombre,
      role: 'coordinator',
      institucion
    }
  });
});

router.get('/coordinators/all', requireRole('admin'), (req, res) => {
  const coordinators = db.prepare(
    'SELECT id, documento, nombre, role, institucion FROM users WHERE role = ? ORDER BY nombre'
  ).all('coordinator');

  res.json(coordinators);
});

router.put('/:id', requireRole('admin'), [
  param('id').isInt(),
  body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('documento').optional().notEmpty().withMessage('El documento no puede estar vacío'),
  body('institucion').optional().notEmpty().withMessage('La institución no puede estar vacía'),
  body('horas_totales').optional().isNumeric().withMessage('Las horas totales deben ser numéricas')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const student = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(Number(req.params.id), 'student');
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  const { nombre, documento, horas_totales, institucion } = req.body;

  if (documento && documento !== student.documento) {
    const existing = db.prepare('SELECT id FROM users WHERE documento = ? AND id != ?').get(documento, Number(req.params.id));
    if (existing) {
      return res.status(409).json({ error: 'Ya existe otro registro con ese documento' });
    }
  }

  db.prepare(
    'UPDATE users SET nombre = ?, documento = ?, horas_totales = ?, institucion = ?, updated_at = datetime("now","localtime") WHERE id = ?'
  ).run(
    nombre || student.nombre,
    documento || student.documento,
    (horas_totales && Number.isInteger(horas_totales)) ? horas_totales : student.horas_totales,
    institucion || student.institucion,
    Number(req.params.id)
  );

  const updated = db.prepare(
    'SELECT id, documento, nombre, role, institucion, horas_completadas, horas_totales, updated_at FROM users WHERE id = ?'
  ).get(Number(req.params.id));

  res.json({ message: 'Estudiante actualizado', student: updated });
});

router.put('/:id/horas', [
  param('id').isInt(),
  body('horas_completadas').isNumeric().withMessage('Las horas completadas deben ser numéricas')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const student = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(Number(req.params.id), 'student');
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  if (req.user.role === 'coordinator' && student.institucion !== req.user.institucion) {
    return res.status(403).json({ error: 'No tienes acceso a este estudiante' });
  }

  const { horas_completadas } = req.body;

  if (!Number.isInteger(horas_completadas) || horas_completadas < 0 || horas_completadas > student.horas_totales) {
    return res.status(400).json({
      error: `Las horas completadas deben ser números enteros entre 0 y ${student.horas_totales}`
    });
  }

  db.prepare(
    'UPDATE users SET horas_completadas = ?, updated_at = datetime("now","localtime") WHERE id = ?'
  ).run(horas_completadas, Number(req.params.id));

  const updated = db.prepare(
    'SELECT id, documento, nombre, role, institucion, horas_completadas, horas_totales, updated_at FROM users WHERE id = ?'
  ).get(Number(req.params.id));

  res.json({ message: 'Horas actualizadas', student: updated });
});

router.delete('/:id', requireRole('admin'), [
  param('id').isInt()
], (req, res) => {
  const student = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(Number(req.params.id), 'student');
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  db.prepare('DELETE FROM asistencia WHERE estudiante_id = ?').run(Number(req.params.id));
  db.prepare('DELETE FROM users WHERE id = ?').run(Number(req.params.id));

  res.json({ message: 'Estudiante eliminado exitosamente' });
});

module.exports = router;
