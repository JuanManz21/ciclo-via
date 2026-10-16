const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

router.get('/', authenticate, requireRole('student'), (req, res) => {
  const user = db.prepare(
    'SELECT id, documento, nombre, institucion, grado, horas_completadas, horas_totales FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (user.horas_completadas < user.horas_totales) {
    return res.status(400).json({ error: 'Aún no has completado todas las horas requeridas' });
  }

  // Año(s) donde realizó el servicio social, según sus asistencias
  let anioServicio = String(new Date().getFullYear());
  try {
    const row = db.prepare(
      "SELECT MIN(substr(fecha,1,4)) as desde, MAX(substr(fecha,1,4)) as hasta FROM asistencia WHERE estudiante_id = ?"
    ).get(req.user.id);
    if (row && row.desde) {
      anioServicio = row.desde === row.hasta ? String(row.desde) : `${row.desde} - ${row.hasta}`;
    }
  } catch (e) {}

  const hoy = new Date();
  const fechaGen = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const doc = new PDFDocument({ size: 'letter', layout: 'portrait', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=certificado_${user.documento}.pdf`);

  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;

  // Fondo blanco
  doc.rect(0, 0, W, H).fill('#ffffff');

  // Franja roja lateral izquierda
  doc.rect(0, 0, 28, H).fill('#d40e14');

  const LEFT = 55;
  const RIGHT = W - 55;
  const WIDTH = RIGHT - LEFT;

  // Logo (si existe client/img/logo.png) + encabezado corporación
  const logoPath = path.join(__dirname, '..', '..', 'client', 'img', 'logo.png');
  let cursorY = 40;
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, LEFT, cursorY, { width: 130 });
    }
  } catch (e) {}

  doc.fillColor('#000000').font('Helvetica').fontSize(10);
  doc.text('Corporación Juvenil', LEFT, cursorY + 2, { width: WIDTH });
  doc.font('Helvetica-Bold').fontSize(20).text('LA COMUNA', LEFT, cursorY + 15, { width: WIDTH });
  doc.font('Helvetica').fontSize(7).fillColor('#333333');
  doc.text('INSTITUCIÓN SIN ÁNIMO DE LUCRO AL SERVICIO DE LA COMUNIDAD DESDE 1973', LEFT, cursorY + 40, { width: 260 });

  cursorY = 130;

  const par = (text, opts = {}) => {
    doc.font('Helvetica').fontSize(11).fillColor('#000000');
    doc.text(text, LEFT, doc.y, { width: WIDTH, align: 'justify', lineGap: 3, ...opts });
    doc.moveDown(0.8);
  };

  const boldPar = (segments) => {
    // segments: [{t, b}] para mezclar normal y negrita en justificado simple
    const full = segments.map(s => s.t).join('');
    doc.font('Helvetica').fontSize(11).fillColor('#000000');
    doc.text(full, LEFT, doc.y, { width: WIDTH, align: 'justify', lineGap: 3 });
    doc.moveDown(0.8);
  };

  doc.y = cursorY;

  // Fecha generación (dinámica)
  doc.font('Helvetica').fontSize(11);
  doc.text(`Medellín, ${fechaGen}`, LEFT, doc.y, { width: WIDTH, align: 'left' });
  doc.moveDown(1.5);

  par('Señor(a):');
  par('Coordinador Servicio Social.');
  // Nombre IE (dinámico)
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000');
  doc.text(user.institucion || '', LEFT, doc.y, { width: WIDTH, align: 'left', underline: true });
  doc.moveDown(1.5);

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Asunto: Certificación horas servicio social.', LEFT, doc.y, { width: WIDTH, align: 'left' });
  doc.moveDown(1);

  par('Un cordial saludo,');

  // Cuerpo con campos dinámicos: nombre, documento, grado, horas, año
  boldPar([{
    t: `La Corporación Juvenil La Comuna, institución que coordina y dirige la vía recreativa de Manrique, según resolución 513 de julio 06 2007, certifica, que ${user.nombre}, con DI N° ${user.documento}, estudiante del ${user.grado || ''} recibió orientación, asesoría y capacitación para la elaboración y ejecución del programa Vía Recreativa y Cultural de Manrique y durante su servicio social, realizo actividades en recreación dirigida, apoyo logístico, campañas de sensibilización vial y campañas de cultura ciudadana, cumpliendo con un total de ${user.horas_completadas} horas, realizadas durante el año ${anioServicio}, dando así cumplimiento al servicio social estudiantil obligatorio según lo dispone en el art 97 de la ley 115 de 1994 y su decreto reglamentario 1860 del mismo año.`
  }]);

  par('Atentamente,');
  doc.moveDown(2);

  doc.font('Helvetica').fontSize(11);
  doc.text('_______________________________', LEFT, doc.y, { width: WIDTH, align: 'left' });
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').text('Luis Carlos Molina Restrepo', LEFT, doc.y, { width: WIDTH, align: 'left' });
  doc.font('Helvetica').text('Presidente', LEFT, doc.y, { width: WIDTH, align: 'left' });
  doc.text('Email: corporacionjuvenillacomuna@gmail.com', LEFT, doc.y, { width: WIDTH, align: 'left' });

  // Pie de página
  doc.font('Helvetica').fontSize(8).fillColor('#000000');
  doc.text(
    'Corporación Juvenil La Comuna   Nit: 900 383 924 -8   Dir: Cra 45 N 72 -76   Cel: 301 649 34 62',
    LEFT,
    H - 45,
    { width: WIDTH, align: 'center' }
  );

  doc.end();
});

module.exports = router;
