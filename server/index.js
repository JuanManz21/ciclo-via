const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase, prepare } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

function runSeed() {
  const adminDoc = '0000000';
  const existing = prepare('SELECT id FROM users WHERE documento = ?').get(adminDoc);
  if (!existing) {
    const hashed = bcrypt.hashSync('admin123', 10);
    prepare('INSERT INTO users (documento, nombre, password, role, institucion, horas_completadas, horas_totales) VALUES (?, ?, ?, ?, ?, ?, ?)').run(adminDoc, 'Administrador', hashed, 'admin', 'Sistema', 0, 0);
    console.log('Admin creado: 0000000 / admin123');
  }
}

async function start() {
  await initDatabase();
  runSeed();
  console.log('Base de datos inicializada.');

  app.use(cors());
  app.use(express.json());

  app.use(express.static(path.join(__dirname, '..', 'client')));

  const authRoutes = require('./routes/auth');
  const studentRoutes = require('./routes/students');
  const progressRoutes = require('./routes/progress');
  const attendanceRoutes = require('./routes/attendance');
  const certificateRoutes = require('./routes/certificate');

  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/my-progress', progressRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/certificate', certificateRoutes);

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Ciclo Vía corriendo en http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
