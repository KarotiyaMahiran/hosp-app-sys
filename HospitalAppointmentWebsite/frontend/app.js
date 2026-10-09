(() => {
  const API = (window.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');
  const $ = (id) => document.getElementById(id);
  let token = sessionStorage.getItem('medicare_token') || '';
  let doctors = [], patients = [], appointments = [], statusColumnAvailable = false;
  let currentPage = 'dashboard';
  const pageMeta = {
    dashboard: ['OVERVIEW', 'Good to see you, Admin ✦', 'Here’s what’s happening with your hospital today.'],
    doctors: ['DIRECTORY', 'Doctor management', 'Register doctors and keep the directory organized.'],
    patients: ['PATIENT RECORDS', 'Patient management', 'Manage patient information in one place.'],
    book: ['NEW BOOKING', 'Book an appointment', 'Connect a patient with a doctor and select a suitable slot.'],
    appointments: ['SCHEDULE', 'View appointments', 'Review bookings and update their status.']
  };
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetch(`${API}${path}`, { ...options, headers }); }
    catch { throw new Error(`Could not reach the backend at ${API}. Start the backend or update frontend/config.js to your deployed API URL.`); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) logout(false);
      throw new Error(data.error || 'Something went wrong.');
    }
    return data;
  }
  function showToast(message, bad = false) {
    const el = $('toast'); el.textContent = message; el.className = `toast show${bad ? ' toast-error' : ''}`;
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { el.className = 'toast'; }, 3600);
  }
  function setNotice(message = '', bad = false) {
    const el = $('notice'); el.textContent = message; el.classList.toggle('hidden', !message); el.classList.toggle('notice-error', bad);
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase(); }
  function formatDate(value) {
    if (!value) return '—';
    const s = String(value).slice(0, 10); const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
  }
  function formatTime(value) {
    if (!value) return '—';
    const [h, m] = String(value).split(':'); const date = new Date(); date.setHours(Number(h), Number(m), 0, 0);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function showLogin() { $('loginScreen').classList.remove('hidden'); $('appShell').classList.add('hidden'); }
  function showApp() { $('loginScreen').classList.add('hidden'); $('appShell').classList.remove('hidden'); navigate('dashboard'); refreshAll().catch(e => setNotice(e.message, true)); }
  function logout(showMessage = true) { token = ''; sessionStorage.removeItem('medicare_token'); showLogin(); if (showMessage) showToast('You have been logged out.'); }
  function navigate(page) {
    if (!pageMeta[page]) return;
    currentPage = page;
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    $(`${page}Page`).classList.remove('hidden');
    document.querySelectorAll('.nav-link[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    $('pageCrumb').textContent = pageMeta[page][1].replace(' ✦', '');
    $('pageEyebrow').textContent = pageMeta[page][0]; $('pageTitle').textContent = pageMeta[page][1]; $('pageSubtitle').textContent = pageMeta[page][2];
    $('headingAction').classList.toggle('hidden', page === 'book'); $('headingAction').textContent = page === 'doctors' ? '＋ Add doctor' : page === 'patients' ? '＋ Add patient' : '＋ Book appointment';
    $('headingAction').dataset.go = page === 'doctors' ? 'doctors' : page === 'patients' ? 'patients' : 'book';
    $('sidebar').classList.remove('sidebar-open'); setNotice('');
    if (page === 'doctors') renderDoctors(); if (page === 'patients') renderPatients(); if (page === 'appointments') renderAppointments(); if (page === 'book') fillBookingOptions();
  }
  async function refreshAll() {
    const [dashboard, doctorRows, patientRows, appointmentResult] = await Promise.all([
      api('/dashboard'), api('/doctors'), api('/patients'), api('/appointments')
    ]);
    doctors = doctorRows; patients = patientRows; appointments = appointmentResult.rows || []; statusColumnAvailable = !!appointmentResult.statusColumnAvailable;
    $('statDoctors').textContent = dashboard.doctors; $('statPatients').textContent = dashboard.patients; $('statAppointments').textContent = dashboard.appointments;
    $('navDoctors').textContent = doctors.length; $('navPatients').textContent = patients.length; $('navAppointments').textContent = appointments.length;
    $('doctorPageCount').textContent = doctors.length; $('patientPageCount').textContent = patients.length;
    renderDoctors(); renderPatients(); renderAppointments(); renderRecent(); fillBookingOptions();
    $('statusInfo').classList.toggle('hidden', statusColumnAvailable);
    if (!statusColumnAvailable) $('statusInfo').textContent = 'Your existing appointments table has no status column. Booking and viewing work now; to enable Pending / Confirmed / Cancelled updates, see database/add_status_column.sql in the project ZIP.';
  }
  function renderDoctors() {
    const q = ($('doctorSearch')?.value || '').toLowerCase();
    const rows = doctors.filter(d => [d.doctor_name, d.specialization, d.phone, d.doctor_id].some(v => String(v ?? '').toLowerCase().includes(q)));
    $('doctorsTable').innerHTML = rows.length ? `<table><thead><tr><th>DOCTOR</th><th>ID</th><th>SPECIALIZATION</th><th>PHONE</th></tr></thead><tbody>${rows.map(d => `<tr><td><div class="person-cell"><span class="person-avatar teal-avatar">${escapeHtml(initials(d.doctor_name))}</span><strong>${escapeHtml(d.doctor_name)}</strong></div></td><td><span class="id-pill">DOC-${String(d.doctor_id).padStart(3, '0')}</span></td><td><span class="specialty-pill">${escapeHtml(d.specialization)}</span></td><td>${escapeHtml(d.phone || '—')}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state"><span>⚕</span><strong>No doctors found</strong><p>Register a doctor using the form above.</p></div>`;
  }
  function renderPatients() {
    const q = ($('patientSearch')?.value || '').toLowerCase();
    const rows = patients.filter(p => [p.patient_name, p.gender, p.phone, p.patient_id, p.age].some(v => String(v ?? '').toLowerCase().includes(q)));
    $('patientsTable').innerHTML = rows.length ? `<table><thead><tr><th>PATIENT</th><th>ID</th><th>AGE</th><th>GENDER</th><th>PHONE</th></tr></thead><tbody>${rows.map(p => `<tr><td><div class="person-cell"><span class="person-avatar blue-avatar">${escapeHtml(initials(p.patient_name))}</span><strong>${escapeHtml(p.patient_name)}</strong></div></td><td><span class="id-pill">PAT-${String(p.patient_id).padStart(3, '0')}</span></td><td>${escapeHtml(p.age ?? '—')}</td><td>${escapeHtml(p.gender || '—')}</td><td>${escapeHtml(p.phone || '—')}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state"><span>♙</span><strong>No patients found</strong><p>Register a patient using the form above.</p></div>`;
  }
  function statusBadge(status) { const value = status || 'Booked'; const cls = String(value).toLowerCase(); return `<span class="status-badge status-${escapeHtml(cls)}">${escapeHtml(value)}</span>`; }
  function appointmentTable(rows, compact = false) {
    if (!rows.length) return `<div class="empty-state"><span>▣</span><strong>No appointments yet</strong><p>New bookings will appear here.</p></div>`;
    return `<table><thead><tr><th>APPOINTMENT</th><th>PATIENT</th><th>DOCTOR</th><th>DATE & TIME</th><th>STATUS</th>${compact ? '' : '<th>ACTION</th>'}</tr></thead><tbody>${rows.map(a => `<tr><td><span class="id-pill">APT-${String(a.appointment_id).padStart(3, '0')}</span></td><td><div class="table-primary">${escapeHtml(a.patient_name)}</div></td><td><div class="table-primary">${escapeHtml(a.doctor_name)}</div><small class="table-secondary">${escapeHtml(a.specialization || '')}</small></td><td><div class="table-primary">${escapeHtml(formatDate(a.appointment_date))}</div><small class="table-secondary">${escapeHtml(formatTime(a.appointment_time))}</small></td><td>${statusBadge(a.status)}</td>${compact ? '' : `<td>${statusColumnAvailable ? `<select class="status-select" data-status-id="${a.appointment_id}" aria-label="Change appointment status"><option ${a.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${a.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option><option ${a.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select>` : '<span class="table-secondary">—</span>'}</td>`}</tr>`).join('')}</tbody></table>`;
  }
  function renderAppointments() {
    const q = ($('appointmentSearch')?.value || '').toLowerCase();
    const rows = appointments.filter(a => [a.patient_name, a.doctor_name, a.specialization, a.appointment_id, a.status, a.appointment_date].some(v => String(v ?? '').toLowerCase().includes(q)));
    $('appointmentsTable').innerHTML = appointmentTable(rows);
  }
  function renderRecent() { $('recentAppointments').innerHTML = appointmentTable(appointments.slice(0, 4), true); }
  function fillBookingOptions() {
    const ps = $('patientSelect'), ds = $('doctorSelect'); if (!ps || !ds) return;
    const pv = ps.value, dv = ds.value;
    ps.innerHTML = '<option value="">Choose a patient</option>' + patients.map(p => `<option value="${p.patient_id}">${escapeHtml(p.patient_name)} · #${p.patient_id}</option>`).join('');
    ds.innerHTML = '<option value="">Choose a doctor</option>' + doctors.map(d => `<option value="${d.doctor_id}">${escapeHtml(d.doctor_name)} — ${escapeHtml(d.specialization)}</option>`).join('');
    if (pv) ps.value = pv; if (dv) ds.value = dv;
  }
  async function handleForm(form, path, success) {
    const button = form.querySelector('[type="submit"]'); const original = button.textContent; button.disabled = true; button.textContent = 'Saving…';
    try { const payload = Object.fromEntries(new FormData(form).entries()); await api(path, { method: 'POST', body: JSON.stringify(payload) }); form.reset(); showToast(success); await refreshAll(); }
    catch (e) { showToast(e.message, true); }
    finally { button.disabled = false; button.textContent = original; }
  }
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('loginError').textContent = '';
    const button = e.currentTarget.querySelector('button'); button.disabled = true; button.innerHTML = 'Signing in…';
    try { const result = await api('/login', { method: 'POST', body: JSON.stringify({ username: $('username').value.trim(), password: $('password').value }) }); token = result.token; sessionStorage.setItem('medicare_token', token); showApp(); }
    catch (err) { $('loginError').textContent = err.message; }
    finally { button.disabled = false; button.innerHTML = 'Sign in <span>→</span>'; }
  });
  $('doctorForm').addEventListener('submit', e => { e.preventDefault(); handleForm(e.currentTarget, '/doctors', 'Doctor saved successfully.'); });
  $('patientForm').addEventListener('submit', e => { e.preventDefault(); handleForm(e.currentTarget, '/patients', 'Patient saved successfully.'); });
  $('appointmentForm').addEventListener('submit', e => { e.preventDefault(); handleForm(e.currentTarget, '/appointments', 'Appointment booked successfully.'); });
  $('logoutBtn').addEventListener('click', () => logout());
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-page]'); if (nav) navigate(nav.dataset.page);
    const go = e.target.closest('[data-go]'); if (go) navigate(go.dataset.go);
  });
  $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('sidebar-open'));
  $('doctorSearch').addEventListener('input', renderDoctors); $('patientSearch').addEventListener('input', renderPatients); $('appointmentSearch').addEventListener('input', renderAppointments);
  document.addEventListener('change', async e => {
    const select = e.target.closest('[data-status-id]'); if (!select) return;
    const previous = appointments.find(a => String(a.appointment_id) === select.dataset.statusId)?.status || 'Pending';
    try { await api(`/appointments/${select.dataset.statusId}/status`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); showToast('Appointment status updated.'); await refreshAll(); }
    catch (err) { select.value = previous; showToast(err.message, true); }
  });
  $('appointmentDate').min = new Date().toLocaleDateString('en-CA');
  if (token) showApp(); else showLogin();
})();
