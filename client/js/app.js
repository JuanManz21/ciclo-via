let currentUser = null;
let allStudents = [];

document.addEventListener('DOMContentLoaded', () => {
  currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  if (!token || !currentUser) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('navUserName').textContent = currentUser.nombre;
  const badge = document.getElementById('navUserRole');
  badge.textContent = currentUser.role === 'admin' ? 'Admin' : 'Alfabetizador';
  badge.className = `badge badge-${currentUser.role}`;

  if (currentUser.role === 'admin') {
    document.getElementById('adminPanel').style.display = 'block';
    loadStudents();
  } else {
    document.getElementById('studentPanel').style.display = 'block';
    loadMyProgress();
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  setupModals();
  setupSearch();
});

/* ===== ADMIN FUNCTIONS ===== */

async function loadStudents() {
  try {
    allStudents = await apiRequest('/students');
    renderStudents(allStudents);
  } catch (err) {
    console.error('Error cargando estudiantes:', err);
  }
}

function renderStudents(students) {
  const tbody = document.getElementById('studentsBody');
  const noStudents = document.getElementById('noStudents');

  if (students.length === 0) {
    tbody.innerHTML = '';
    noStudents.style.display = 'block';
    return;
  }

  noStudents.style.display = 'none';

  tbody.innerHTML = students.map(s => {
    const faltantes = Math.max(0, s.horas_totales - s.horas_completadas);
    const pct = s.horas_totales > 0
      ? Math.round((s.horas_completadas / s.horas_totales) * 100)
      : 0;

    return `
      <tr>
        <td>${s.documento}</td>
        <td>${s.nombre}</td>
        <td>${s.horas_completadas}h</td>
        <td>${faltantes}h</td>
        <td>
          <div class="progress-bar" style="height:8px; min-width:80px;">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <span style="font-size:12px;">${pct}%</span>
        </td>
        <td class="actions">
          <button class="btn btn-sm btn-primary" onclick="openHoursModal(${s.id}, '${s.nombre.replace(/'/g,"\\'")}', ${s.horas_completadas}, ${s.horas_totales})">Horas</button>
          <button class="btn btn-sm btn-outline" onclick="openEditModal(${s.id}, '${s.documento}', '${s.nombre.replace(/'/g,"\\'")}', ${s.horas_totales})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${s.id}, '${s.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allStudents.filter(s =>
      s.documento.toLowerCase().includes(query) ||
      s.nombre.toLowerCase().includes(query)
    );
    renderStudents(filtered);
  });
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
    const statusClass = {
      'Completado': 'status-completado',
      'Casi termina': 'status-casi',
      'A la mitad': 'status-mitad',
      'En camino': 'status-camino',
      'En progreso': 'status-progreso'
    };
    badge.className = `status-badge ${statusClass[data.estado] || 'status-progreso'}`;

    if (data.updated_at) {
      document.getElementById('lastUpdate').textContent = data.updated_at;
    }

    currentUser.horas_completadas = data.horas_completadas;
    currentUser.horas_totales = data.horas_totales;
    localStorage.setItem('user', JSON.stringify(currentUser));
  } catch (err) {
    console.error('Error cargando progreso:', err);
  }
}

/* ===== MODALS ===== */

function setupModals() {
  const studentModal = document.getElementById('studentModal');
  const hoursModal = document.getElementById('hoursModal');
  const deleteModal = document.getElementById('deleteModal');

  document.getElementById('btnNewStudent')?.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Nuevo Estudiante';
    document.getElementById('studentId').value = '';
    document.getElementById('studentDoc').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('studentPass').value = '';
    document.getElementById('studentHours').value = '480';
    document.getElementById('studentDoc').disabled = false;
    document.getElementById('formError').style.display = 'none';
    studentModal.style.display = 'flex';
  });

  document.getElementById('modalClose').addEventListener('click', () => studentModal.style.display = 'none');
  document.getElementById('modalCancel').addEventListener('click', () => studentModal.style.display = 'none');

  document.getElementById('hoursModalClose').addEventListener('click', () => hoursModal.style.display = 'none');
  document.getElementById('hoursCancel').addEventListener('click', () => hoursModal.style.display = 'none');

  document.getElementById('deleteModalClose').addEventListener('click', () => deleteModal.style.display = 'none');
  document.getElementById('deleteCancel').addEventListener('click', () => deleteModal.style.display = 'none');

  window.addEventListener('click', (e) => {
    if (e.target === studentModal) studentModal.style.display = 'none';
    if (e.target === hoursModal) hoursModal.style.display = 'none';
    if (e.target === deleteModal) deleteModal.style.display = 'none';
  });

  document.getElementById('studentForm').addEventListener('submit', handleStudentSubmit);
  document.getElementById('hoursForm').addEventListener('submit', handleHoursSubmit);
  document.getElementById('deleteConfirm').addEventListener('click', handleDelete);
}

async function handleStudentSubmit(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('formError');
  errorDiv.style.display = 'none';

  const id = document.getElementById('studentId').value;
  const documento = document.getElementById('studentDoc').value.trim();
  const nombre = document.getElementById('studentName').value.trim();
  const password = document.getElementById('studentPass').value;
  const horas_totales = parseInt(document.getElementById('studentHours').value) || 480;

  try {
    if (id) {
      await apiRequest(`/students/${id}`, {
        method: 'PUT',
        body: { documento, nombre, horas_totales }
      });
    } else {
      if (!password || password.length < 4) {
        throw new Error('La contraseña debe tener al menos 4 caracteres');
      }
      await apiRequest('/students', {
        method: 'POST',
        body: { documento, nombre, password, horas_totales }
      });
    }

    document.getElementById('studentModal').style.display = 'none';
    loadStudents();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.style.display = 'block';
  }
}

async function handleHoursSubmit(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('hoursError');
  errorDiv.style.display = 'none';

  const id = document.getElementById('hoursStudentId').value;
  const horasAgregar = parseInt(document.getElementById('hoursToAdd').value);

  const student = allStudents.find(s => s.id == id);
  const nuevasHoras = student.horas_completadas + horasAgregar;

  try {
    await apiRequest(`/students/${id}/horas`, {
      method: 'PUT',
      body: { horas_completadas: nuevasHoras }
    });

    document.getElementById('hoursModal').style.display = 'none';
    loadStudents();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.style.display = 'block';
  }
}

async function handleDelete() {
  const id = document.getElementById('deleteStudentId').value;

  try {
    await apiRequest(`/students/${id}`, { method: 'DELETE' });
    document.getElementById('deleteModal').style.display = 'none';
    loadStudents();
  } catch (err) {
    alert(err.message);
  }
}

/* ===== OPEN MODALS ===== */

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

function openEditModal(id, documento, nombre, horasTotales) {
  document.getElementById('modalTitle').textContent = 'Editar Estudiante';
  document.getElementById('studentId').value = id;
  document.getElementById('studentDoc').value = documento;
  document.getElementById('studentDoc').disabled = true;
  document.getElementById('studentName').value = nombre;
  document.getElementById('studentPass').value = '';
  document.getElementById('studentHours').value = horasTotales;
  document.getElementById('formError').style.display = 'none';
  document.getElementById('studentModal').style.display = 'flex';
}

function openDeleteModal(id, nombre) {
  document.getElementById('deleteStudentId').value = id;
  document.getElementById('deleteStudentName').textContent = nombre;
  document.getElementById('deleteModal').style.display = 'flex';
}
