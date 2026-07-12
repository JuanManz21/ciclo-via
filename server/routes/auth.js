const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.post('/login', [
  body('documento').notEmpty().withMessage('El documento es requerido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { documento, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE documento = ?').get(documento);

  if (!user) {
    return res.status(401).json({ error: 'Documento o contraseña incorrectos' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Documento o contraseña incorrectos' });
  }

  const token = jwt.sign(
    { id: user.id, documento: user.documento, nombre: user.nombre, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      documento: user.documento,
      nombre: user.nombre,
      role: user.role,
      horas_completadas: user.horas_completadas,
      horas_totales: user.horas_totales
    }
  });
});

router.post('/register', authenticate, requireRole('admin'), [
  body('documento').notEmpty().withMessage('El documento es requerido'),
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('password').isLength({ min: 4 }).withMessage('La contraseña debe tener al menos 4 caracteres')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { documento, nombre, password, horas_totales } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE documento = ?').get(documento);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un estudiante con ese documento' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const horas = horas_totales || 480;

  const result = db.prepare(
    'INSERT INTO users (documento, nombre, password, role, horas_totales) VALUES (?, ?, ?, ?, ?)'
  ).run(documento, nombre, hashedPassword, 'student', horas);

  res.status(201).json({
    message: 'Estudiante registrado exitosamente',
    student: {
      id: result.lastInsertRowid,
      documento,
      nombre,
      role: 'student',
      horas_completadas: 0,
      horas_totales: horas
    }
  });
});

module.exports = router;
