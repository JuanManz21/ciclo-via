let currentUser = null;
let allStudents = [];
let allCoordinators = [];
let allAttendance = [];
let studentListForAtt = [];

document.addEventListener('DOMContentLoaded', () => {
  currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  if (!token || !currentUser) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('navUserName').textContent = currentUser.nombre;
  const badge = document.getElementById('navUserRole');
  const roles = { admin: 'Admin', coordinator: 'Coordinador', student: 'Alfabetizador' };
  badge.textContent = roles[currentUser.role] || currentUser.role;
  badge.className = `badge badge-${currentUser.role}`;

  if (currentUser.institucion && currentUser.role !== 'admin') {
    document.getElementById('navUserInst').textContent = currentUser.institucion;
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  setupTabs();

  if (currentUser.role === 'admin') {
    document.getElementById('adminPanel').style.display = 'block';
    loadStudents();
    loadCoordinators();
    loadAttendance();
  } else if (currentUser.role === 'coordinator') {
    document.getElementById('coordinatorPanel').style.display = 'block';
    loadStudentsCoord();
    loadAttendanceCoord();
  } else {
    document.getElementById('studentPanel').style.display = 'block';
    loadMyProgress();
  }

  setupModals();
  setupSearch();
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('.tabs') || tab.parentElement;
      group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabId = tab.dataset.tab;
      const container = group.parentElement;
      container.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      const target = container.querySelector(`#tab-${tabId}`);
      if (target) target.style.display = 'block';
    });
  });
}

function setupSearch() {
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderStudents(allStudents.filter(s =>
      s.documento.toLowerCase().includes(q) || s.nombre.toLowerCase().includes(q) || (s.institucion || '').toLowerCase().includes(q)
    ));
  });
  document.getElementById('searchInputCoord')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderStudentsCoord(allStudents.filter(s =>
      s.documento.toLowerCase().includes(q) || s.nombre.toLowerCase().includes(q)
    ));
  });
}

/* ===== ADMIN: STUDENTS ===== */

async function loadStudents() {
  try {
    allStudents = await apiRequest('/students');
    renderStudents(allStudents);
  } catch (err) { console.error(err); }
}

function renderStudents(students) {
  const tbody = document.getElementById('studentsBody');
  const empty = document.getElementById('noStudents');
  if (!students.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = students.map(s => {
    const f = Math.max(0, s.horas_totales - s.horas_completadas);
    const p = s.horas_totales > 0 ? Math.round((s.horas_completadas / s.horas_totales) * 100) : 0;
    return `<tr>
      <td>${s.documento}</td><td>${s.nombre}</td><td>${s.institucion || '-'}</td>
      <td>${s.horas_completadas}h</td><td>${f}h</td>
      <td><div class="progress-bar" style="height:8px;min-width:80px;"><div class="progress-fill" style="width:${p}%"></div></div><span style="font-size:12px;">${p}%</span></td>
      <td class="actions">
        <button class="btn btn-sm btn-primary" onclick="openHoursModal(${s.id},'${esc(s.nombre)}',${s.horas_completadas},${s.horas_totales})">Horas</button>
        <button class="btn btn-sm btn-outline" onclick="openEditModal(${s.id},'${esc(s.documento)}','${esc(s.nombre)}','${esc(s.institucion||'')}',${s.horas_totales})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${s.id},'${esc(s.nombre)}','student')">Eliminar</button>
      </td></tr>`;
  }).join('');
}

function esc(str) { return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

/* ===== ADMIN: COORDINATORS ===== */

async function loadCoordinators() {
  try {
    allCoordinators = await apiRequest('/students/coordinators/all');
    renderCoordinators(allCoordinators);
  } catch (err) { console.error(err); }
}

function renderCoordinators(coords) {
  const tbody = document.getElementById('coordinatorsBody');
  const empty = document.getElementById('noCoordinators');
  if (!coords.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = coords.map(c => `<tr>
    <td>${c.documento}</td><td>${c.nombre}</td><td>${c.institucion}</td>
    <td class="actions"><button class="btn btn-sm btn-danger" onclick="openDeleteModal(${c.id},'${esc(c.nombre)}','coordinator')">Eliminar</button></td></tr>`
  ).join('');
}

/* ===== ADMIN: ATTENDANCE ===== */

async function loadAttendance() {
  try {
    allAttendance = await apiRequest('/attendance');
    renderAttendance(allAttendance, 'attendanceBody', 'noAttendance', true);
    const students = await apiRequest('/students');
    studentListForAtt = students;
  } catch (err) { console.error(err); }
}

async function loadAttendanceCoord() {
  try {
    allAttendance = await apiRequest('/attendance');
    renderAttendance(allAttendance, 'attendanceBodyCoord', 'noAttendanceCoord', false);
    const students = await apiRequest('/students');
    studentListForAtt = students;
  } catch (err) { console.error(err); }
}

function renderAttendance(records, tbodyId, emptyId, showDelete) {
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  if (!records.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = records.map(r => `<tr>
    <td>${r.fecha}</td><td>${r.estudiante_nombre}</td><td>${r.estudiante_documento}</td>
    ${showDelete ? `<td>${r.institucion || '-'}</td>` : ''}
    <td>${r.horas}h</td><td>${r.observacion || '-'}</td>
    ${showDelete ? `<td><button class="btn btn-sm btn-danger" onclick="deleteAttendance(${r.id})">Eliminar</button></td>` : ''}
  </tr>`).join('');
}

async function deleteAttendance(id) {
  if (!confirm('¿Eliminar este registro? Las horas se ajustarán automáticamente.')) return;
  try {
    await apiRequest(`/attendance/${id}`, { method: 'DELETE' });
    loadAttendance();
  } catch (err) { alert(err.message); }
}

document.getElementById('btnFilterAttendance')?.addEventListener('click', async () => {
  const fi = document.getElementById('filterDateStart').value;
  const ff = document.getElementById('filterDateEnd').value;
  let url = '/attendance?';
  if (fi) url += `fecha_inicio=${fi}&`;
  if (ff) url += `fecha_fin=${ff}`;
  try {
    allAttendance = await apiRequest(url);
    renderAttendance(allAttendance, 'attendanceBody', 'noAttendance', true);
  } catch (err) { console.error(err); }
});

/* ===== COORDINATOR: STUDENTS ===== */

async function loadStudentsCoord() {
  try {
    allStudents = await apiRequest('/students');
    renderStudentsCoord(allStudents);
  } catch (err) { console.error(err); }
}

function renderStudentsCoord(students) {
  const tbody = document.getElementById('studentsBodyCoord');
  const empty = document.getElementById('noStudentsCoord');
  if (!students.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = students.map(s => {
    const f = Math.max(0, s.horas_totales - s.horas_completadas);
    const p = s.horas_totales > 0 ? Math.round((s.horas_completadas / s.horas_totales) * 100) : 0;
    return `<tr>
      <td>${s.documento}</td><td>${s.nombre}</td>
      <td>${s.horas_completadas}h</td><td>${f}h</td>
      <td><div class="progress-bar" style="height:8px;min-width:80px;"><div class="progress-fill" style="width:${p}%"></div></div><span style="font-size:12px;">${p}%</span></td>
    </tr>`;
  }).join('');
}

/* ===== STUDENT PROGRESS ===== */

async function loadMyProgress() {
  try {
    const data = await apiRequest('/my-progress');
    document.getElementById('hoursCompleted').textContent = `${data.horas_completadas}h`;
    document.getElementById('hoursTotal').textContent = `${data.horas_totales}h`;
    document.getElementById('hoursRemaining').textContent = `${data.horas_faltantes}h`;
    document.getElementById('progressFill').style.width = `${data.porcentaje}%`;
    document.getElementById('progressPercent').textContent = `${data.porcentaje}%`;

    const badge = document.getElementById('statusBadge');
    badge.textContent = data.estado;
    const sc = { 'Completado': 'status-completado', 'Casi termina': 'status-casi', 'A la mitad': 'status-mitad', 'En camino': 'status-camino', 'En progreso': 'status-progreso' };
    badge.className = `status-badge ${sc[data.estado] || 'status-progreso'}`;

    if (data.updated_at) document.getElementById('lastUpdate').textContent = data.updated_at;

    if (data.porcentaje === 100) {
      document.getElementById('certificateSection').style.display = 'block';
    }

    currentUser.horas_completadas = data.horas_completadas;
    currentUser.horas_totales = data.horas_totales;
    localStorage.setItem('user', JSON.stringify(currentUser));
  } catch (err) { console.error(err); }
}

/* ===== MODALS ===== */

function setupModals() {
  const modals = ['studentModal', 'coordModal', 'hoursModal', 'attendanceModal', 'deleteModal'];
  modals.forEach(id => {
    const m = document.getElementById(id);
    if (!m) return;
    m.querySelector('.modal-close')?.addEventListener('click', () => m.style.display = 'none');
    m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
  });

  document.getElementById('btnNewStudent')?.addEventListener('click', () => openStudentModal());
  document.getElementById('btnNewCoordinator')?.addEventListener('click', () => openCoordModal());
  document.getElementById('btnNewAttendance')?.addEventListener('click', () => openAttendanceModal());
  document.getElementById('modalCancel')?.addEventListener('click', () => document.getElementById('studentModal').style.display = 'none');
  document.getElementById('coordCancel')?.addEventListener('click', () => document.getElementById('coordModal').style.display = 'none');
  document.getElementById('hoursCancel')?.addEventListener('click', () => document.getElementById('hoursModal').style.display = 'none');
  document.getElementById('attCancel')?.addEventListener('click', () => document.getElementById('attendanceModal').style.display = 'none');
  document.getElementById('deleteCancel')?.addEventListener('click', () => document.getElementById('deleteModal').style.display = 'none');
  document.getElementById('deleteModalClose')?.addEventListener('click', () => document.getElementById('deleteModal').style.display = 'none');

  document.getElementById('studentForm')?.addEventListener('submit', handleStudentSubmit);
  document.getElementById('coordForm')?.addEventListener('submit', handleCoordSubmit);
  document.getElementById('hoursForm')?.addEventListener('submit', handleHoursSubmit);
  document.getElementById('attendanceForm')?.addEventListener('submit', handleAttendanceSubmit);
  document.getElementById('deleteConfirm')?.addEventListener('click', handleDelete);

  document.getElementById('btnDownloadCert')?.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/certificate', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.error || 'Error al generar certificado');
        return;
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado_${currentUser.documento}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al descargar certificado');
    }
  });

  document.getElementById('filterDateStart')?.addEventListener('change', () => {});
  document.getElementById('filterDateEnd')?.addEventListener('change', () => {});
}

function openStudentModal(id, doc, nombre, inst, horas) {
  document.getElementById('modalTitle').textContent = id ? 'Editar Estudiante' : 'Nuevo Estudiante';
  document.getElementById('studentId').value = id || '';
  document.getElementById('studentDoc').value = doc || '';
  document.getElementById('studentDoc').disabled = !!id;
  document.getElementById('studentName').value = nombre || '';
  document.getElementById('studentInst').value = inst || (currentUser.institucion && currentUser.role === 'coordinator' ? currentUser.institucion : '');
  document.getElementById('studentPass').value = '';
  document.getElementById('studentHours').value = horas || 480;
  document.getElementById('passGroup').style.display = id ? 'none' : 'block';
  document.getElementById('hoursGroup').style.display = currentUser.role === 'admin' ? 'block' : 'none';
  document.getElementById('studentInst').disabled = currentUser.role === 'coordinator';
  document.getElementById('formError').style.display = 'none';
  document.getElementById('studentModal').style.display = 'flex';
}

function openCoordModal() {
  document.getElementById('coordModalTitle').textContent = 'Nuevo Coordinador';
  document.getElementById('coordId').value = '';
  document.getElementById('coordDoc').value = '';
  document.getElementById('coordName').value = '';
  document.getElementById('coordInst').value = '';
  document.getElementById('coordPass').value = '';
  document.getElementById('coordFormError').style.display = 'none';
  document.getElementById('coordModal').style.display = 'flex';
}

function openHoursModal(id, nombre, horasCompletadas, horasTotales) {
  document.getElementById('hoursStudentId').value = id;
  document.getElementById('hoursStudentName').textContent = nombre;
  document.getElementById('hoursStudentTotal').textContent = `${horasTotales}h`;
  document.getElementById('hoursCurrent').textContent = `${horasCompletadas}h`;
  document.getElementById('hoursToAdd').value = '';
  document.getElementById('hoursToAdd').max = horasTotales - horasCompletadas;
  document.getElementById('hoursError').style.display = 'none';
  document.getElementById('hoursModal').style.display = 'flex';
}

function openAttendanceModal() {
  const sel = document.getElementById('attStudent');
  sel.innerHTML = '<option value="">Seleccionar estudiante...</option>';
  studentListForAtt.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.nombre} (${s.documento}) - ${s.institucion || ''}</option>`;
  });
  document.getElementById('attDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('attHours').value = '';
  document.getElementById('attObs').value = '';
  document.getElementById('attError').style.display = 'none';
  document.getElementById('attendanceModal').style.display = 'flex';
}

function openEditModal(id, doc, nombre, inst, horas) {
  openStudentModal(id, doc, nombre, inst, horas);
}

function openDeleteModal(id, name, type) {
  document.getElementById('deleteItemId').value = id;
  document.getElementById('deleteItemType').value = type;
  document.getElementById('deleteItemName').textContent = name;
  document.getElementById('deleteModal').style.display = 'flex';
}

async function handleStudentSubmit(e) {
  e.preventDefault();
  const errDiv = document.getElementById('formError');
  errDiv.style.display = 'none';

  const id = document.getElementById('studentId').value;
  const documento = document.getElementById('studentDoc').value.trim();
  const nombre = document.getElementById('studentName').value.trim();
  const institucion = document.getElementById('studentInst').value.trim();
  const password = document.getElementById('studentPass').value;
  const horas_totales = parseInt(document.getElementById('studentHours').value) || 480;

  try {
    if (id) {
      await apiRequest(`/students/${id}`, { method: 'PUT', body: { documento, nombre, institucion, horas_totales } });
    } else {
      if (!password || password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres');
      await apiRequest('/students', { method: 'POST', body: { documento, nombre, password, horas_totales, institucion } });
    }
    document.getElementById('studentModal').style.display = 'none';
    if (currentUser.role === 'admin') loadStudents();
    else loadStudentsCoord();
  } catch (err) { errDiv.textContent = err.message; errDiv.style.display = 'block'; }
}

async function handleCoordSubmit(e) {
  e.preventDefault();
  const errDiv = document.getElementById('coordFormError');
  errDiv.style.display = 'none';

  const documento = document.getElementById('coordDoc').value.trim();
  const nombre = document.getElementById('coordName').value.trim();
  const institucion = document.getElementById('coordInst').value.trim();
  const password = document.getElementById('coordPass').value;

  try {
    if (!password || password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres');
    await apiRequest('/students/coordinator', { method: 'POST', body: { documento, nombre, password, institucion } });
    document.getElementById('coordModal').style.display = 'none';
    loadCoordinators();
  } catch (err) { errDiv.textContent = err.message; errDiv.style.display = 'block'; }
}

async function handleHoursSubmit(e) {
  e.preventDefault();
  const errDiv = document.getElementById('hoursError');
  errDiv.style.display = 'none';

  const id = document.getElementById('hoursStudentId').value;
  const horasAgregar = parseInt(document.getElementById('hoursToAdd').value);

  const list = currentUser.role === 'admin' ? allStudents : allStudents;
  const student = list.find(s => s.id == id);
  const nuevasHoras = student.horas_completadas + horasAgregar;

  try {
    await apiRequest(`/students/${id}/horas`, { method: 'PUT', body: { horas_completadas: nuevasHoras } });
    document.getElementById('hoursModal').style.display = 'none';
    if (currentUser.role === 'admin') loadStudents();
    else loadStudentsCoord();
  } catch (err) { errDiv.textContent = err.message; errDiv.style.display = 'block'; }
}

async function handleAttendanceSubmit(e) {
  e.preventDefault();
  const errDiv = document.getElementById('attError');
  errDiv.style.display = 'none';

  const estudiante_id = parseInt(document.getElementById('attStudent').value);
  const fecha = document.getElementById('attDate').value;
  const horas = parseInt(document.getElementById('attHours').value);
  const observacion = document.getElementById('attObs').value;

  try {
    await apiRequest('/attendance', { method: 'POST', body: { estudiante_id, fecha, horas, observacion } });
    document.getElementById('attendanceModal').style.display = 'none';
    if (currentUser.role === 'admin') loadAttendance();
    else loadAttendanceCoord();
  } catch (err) { errDiv.textContent = err.message; errDiv.style.display = 'block'; }
}

async function handleDelete() {
  const id = document.getElementById('deleteItemId').value;
  const type = document.getElementById('deleteItemType').value;

  try {
    if (type === 'student') {
      await apiRequest(`/students/${id}`, { method: 'DELETE' });
      loadStudents();
    } else if (type === 'coordinator') {
      await apiRequest(`/students/${id}`, { method: 'DELETE' });
      loadCoordinators();
    }
    document.getElementById('deleteModal').style.display = 'none';
  } catch (err) { alert(err.message); }
}
