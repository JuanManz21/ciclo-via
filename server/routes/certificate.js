const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', authenticate, requireRole('student'), (req, res) => {
  const user = db.prepare(
    'SELECT id, documento, nombre, institucion, horas_completadas, horas_totales FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (user.horas_completadas < user.horas_totales) {
    return res.status(400).json({ error: 'Aún no has completado todas las horas requeridas' });
  }

  const doc = new PDFDocument({ size: 'letter', layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=certificado_${user.documento}.pdf`);

  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f8f8');

  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(3).stroke('#1a1a6c');

  doc.rect(36, 36, doc.page.width - 72, doc.page.height - 72).lineWidth(1).stroke('#c0a050');

  doc.fontSize(14).fillColor('#666').font('Helvetica').text('CICLO VÍA', 0, 60, { align: 'center' });

  doc.moveDown(1.5);
  doc.fontSize(32).fillColor('#1a1a6c').font('Helvetica-Bold').text('CERTIFICADO', { align: 'center' });

  doc.moveDown(0.3);
  doc.fontSize(16).fillColor('#333').font('Helvetica').text('DE FINALIZACIÓN DE HORAS DE LABOR SOCIAL', { align: 'center' });

  doc.moveDown(1.5);
  doc.fontSize(14).fillColor('#333').font('Helvetica').text('Se certifica que', { align: 'center' });

  doc.moveDown(0.8);
  doc.fontSize(24).fillColor('#1a1a6c').font('Helvetica-Bold').text(user.nombre, { align: 'center' });

  doc.moveDown(0.3);
  doc.fontSize(13).fillColor('#555').font('Helvetica').text(`Identificado con documento: ${user.documento}`, { align: 'center' });

  if (user.institucion) {
    doc.moveDown(0.3);
    doc.text(`Institución Educativa: ${user.institucion}`, { align: 'center' });
  }

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#333').font('Helvetica').text(
    `Ha completado exitosamente ${user.horas_completadas} horas de labor social`, { align: 'center' }
  );

  doc.moveDown(1.5);
  doc.fontSize(11).fillColor('#666').text(
    `Este certificado es válido como constancia de participación en el programa Ciclo Vía.`, { align: 'center' }
  );

  const hoy = new Date();
  const fechaStr = `${hoy.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][hoy.getMonth()]} de ${hoy.getFullYear()}`;

  doc.moveDown(3);
  doc.fontSize(12).fillColor('#333').font('Helvetica');
  doc.text('_______________________________', doc.page.width / 2 - 120, doc.page.y, { align: 'center', width: 240 });
  doc.moveDown(0.3);
  doc.text('Administrador Ciclo Vía', { align: 'center' });
  doc.moveDown(0.3);
  doc.text(fechaStr, { align: 'center' });

  doc.end();
});

module.exports = router;
