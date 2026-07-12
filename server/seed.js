const bcrypt = require('bcryptjs');
const { initDatabase, prepare } = require('./config/database');

async function seed() {
  await initDatabase();

  const adminDoc = '0000000';
  const adminPass = 'admin123';
  const adminName = 'Administrador';

  const existing = prepare('SELECT id FROM users WHERE documento = ?').get(adminDoc);

  if (!existing) {
    const hashed = bcrypt.hashSync(adminPass, 10);
    prepare(
      'INSERT INTO users (documento, nombre, password, role, horas_completadas, horas_totales) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(adminDoc, adminName, hashed, 'admin', 0, 0);

    console.log('Admin creado:');
    console.log(`  Documento: ${adminDoc}`);
    console.log(`  Contraseña: ${adminPass}`);
  } else {
    console.log('El admin ya existe, no se crea de nuevo.');
  }

  const sampleStudents = [
    { documento: '1234567890', nombre: 'María García López', horas: 120 },
    { documento: '1098765432', nombre: 'Carlos Rodríguez Pérez', horas: 350 },
    { documento: '1122334455', nombre: 'Ana Martínez Sánchez', horas: 480 },
  ];

  const hashPass = bcrypt.hashSync('1234', 10);

  for (const s of sampleStudents) {
    const already = prepare('SELECT id FROM users WHERE documento = ?').get(s.documento);
    if (!already) {
      prepare(
        'INSERT INTO users (documento, nombre, password, role, horas_completadas, horas_totales) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(s.documento, s.nombre, hashPass, 'student', s.horas, 480);
      console.log(`Estudiante creado: ${s.nombre} (${s.documento}) - ${s.horas}h`);
    }
  }

  console.log('\nBase de datos inicializada correctamente.');
}

seed().catch(err => {
  console.error('Error en seed:', err);
  process.exit(1);
});
