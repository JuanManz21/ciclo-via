document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (token && user) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';

    const documento = document.getElementById('documento').value.trim();
    const password = document.getElementById('password').value;

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading"></span>';

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { documento, password }
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      window.location.href = 'dashboard.html';
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Iniciar Sesión';
    }
  });
});
