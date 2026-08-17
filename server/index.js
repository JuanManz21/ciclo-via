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

    const hashPass = bcrypt.hashSync('1234', 10);
    const students = [
      { doc: '1234567890', nombre: 'María García López', horas: 120, inst: 'I.E. San Martín' },
      { doc: '1098765432', nombre: 'Carlos Rodríguez Pérez', horas: 350, inst: 'I.E. San Martín' },
      { doc: '1122334455', nombre: 'Ana Martínez Sánchez', horas: 480, inst: 'I.E. La Esperanza' },
    ];
    for (const s of students) {
      prepare('INSERT OR IGNORE INTO users (documento, nombre, password, role, institucion, horas_completadas, horas_totales) VALUES (?, ?, ?, ?, ?, ?, ?)').run(s.doc, s.nombre, hashPass, 'student', s.inst, s.horas, 480);
    }

    const coordHash = bcrypt.hashSync('coord123', 10);
    prepare('INSERT OR IGNORE INTO users (documento, nombre, password, role, institucion, horas_completadas, horas_totales) VALUES (?, ?, ?, ?, ?, ?, ?)').run('9999999', 'Coordinador San Martín', coordHash, 'coordinator', 'I.E. San Martín', 0, 0);

    console.log('Seed ejecutado.');
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
