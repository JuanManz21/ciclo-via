const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

async function start() {
  await initDatabase();
  console.log('Base de datos inicializada.');

  app.use(cors());
  app.use(express.json());

  app.use(express.static(path.join(__dirname, '..', 'client')));

  const authRoutes = require('./routes/auth');
  const studentRoutes = require('./routes/students');
  const progressRoutes = require('./routes/progress');

  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/my-progress', progressRoutes);

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Ciclo Vía corriendo en http://localhost:${PORT}`);
    console.log(`Acceso desde celular: http://<tu-ip-local>:${PORT}`);
  });
}

start().catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
