const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', authenticate, requireRole('student'), (req, res) => {
  const user = db.prepare(
    'SELECT id, documento, nombre, horas_completadas, horas_totales, updated_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const horas_faltantes = user.horas_totales - user.horas_completadas;
  const porcentaje = user.horas_totales > 0
    ? Math.round((user.horas_completadas / user.horas_totales) * 100)
    : 0;

  let estado = 'En progreso';
  if (porcentaje === 100) estado = 'Completado';
  else if (porcentaje >= 75) estado = 'Casi termina';
  else if (porcentaje >= 50) estado = 'A la mitad';
  else if (porcentaje >= 25) estado = 'En camino';

  let fechaFormateada = '';
  if (user.updated_at) {
    const parts = user.updated_at.split(/[- :]/);
    fechaFormateada = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  res.json({
    id: user.id,
    documento: user.documento,
    nombre: user.nombre,
    horas_completadas: user.horas_completadas,
    horas_totales: user.horas_totales,
    horas_faltantes,
    porcentaje,
    estado,
    updated_at: fechaFormateada
  });
});

module.exports = router;
