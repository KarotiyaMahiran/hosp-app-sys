require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5501,http://localhost:5501').split(',').map(s => s.trim());
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); } }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hospital_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});
const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !JWT_SECRET) return res.status(401).json({ error: 'Please log in first.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Your session expired. Please log in again.' }); }
}
async function hasStatusColumn() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'status'");
  return Number(rows[0].total) > 0;
}
function errorResponse(res, err) {
  console.error(err);
  if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') return res.status(500).json({ error: 'Database tables or columns do not match this project. Check README.md and your hospital_db schema.' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This record already exists.' });
  return res.status(500).json({ error: 'Server/database error. Check the backend terminal logs.' });
}

app.get('/api/health', async (req, res) => {
  try { const [rows] = await pool.query('SELECT DATABASE() AS database_name'); res.json({ ok: true, database: rows[0].database_name }); }
  catch (err) { errorResponse(res, err); }
});
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!process.env.ADMIN_PASSWORD || !JWT_SECRET) return res.status(500).json({ error: 'Set ADMIN_PASSWORD and JWT_SECRET in backend .env first.' });
  if (username !== (process.env.ADMIN_USERNAME || 'admin') || password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Incorrect username or password.' });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username });
});
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [[doctors]] = await pool.query('SELECT COUNT(*) AS total FROM doctors');
    const [[patients]] = await pool.query('SELECT COUNT(*) AS total FROM patients');
    const [[appointments]] = await pool.query('SELECT COUNT(*) AS total FROM appointments');
    res.json({ doctors: doctors.total, patients: patients.total, appointments: appointments.total });
  } catch (err) { errorResponse(res, err); }
});
app.get('/api/doctors', requireAuth, async (req, res) => {
  try { const [rows] = await pool.query('SELECT doctor_id, doctor_name, specialization, phone FROM doctors ORDER BY doctor_id DESC'); res.json(rows); }
  catch (err) { errorResponse(res, err); }
});
app.post('/api/doctors', requireAuth, async (req, res) => {
  const { doctor_name, specialization, phone } = req.body || {};
  if (!String(doctor_name || '').trim() || !String(specialization || '').trim()) return res.status(400).json({ error: 'Doctor name and specialization are required.' });
  try { const [result] = await pool.execute('INSERT INTO doctors (doctor_name, specialization, phone) VALUES (?, ?, ?)', [doctor_name.trim(), specialization.trim(), String(phone || '').trim() || null]); res.status(201).json({ message: 'Doctor saved successfully.', doctor_id: result.insertId }); }
  catch (err) { errorResponse(res, err); }
});
app.get('/api/patients', requireAuth, async (req, res) => {
  try { const [rows] = await pool.query('SELECT patient_id, patient_name, age, gender, phone FROM patients ORDER BY patient_id DESC'); res.json(rows); }
  catch (err) { errorResponse(res, err); }
});
app.post('/api/patients', requireAuth, async (req, res) => {
  const { patient_name, age, gender, phone } = req.body || {};
  if (!String(patient_name || '').trim()) return res.status(400).json({ error: 'Patient name is required.' });
  let parsedAge = null;
  if (age !== '' && age !== null && age !== undefined) { parsedAge = Number(age); if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130) return res.status(400).json({ error: 'Enter a valid age.' }); }
  try { const [result] = await pool.execute('INSERT INTO patients (patient_name, age, gender, phone) VALUES (?, ?, ?, ?)', [patient_name.trim(), parsedAge, String(gender || '').trim() || null, String(phone || '').trim() || null]); res.status(201).json({ message: 'Patient saved successfully.', patient_id: result.insertId }); }
  catch (err) { errorResponse(res, err); }
});
app.post('/api/appointments', requireAuth, async (req, res) => {
  const { patient_id, doctor_id, appointment_date, appointment_time } = req.body || {};
  if (!patient_id || !doctor_id || !appointment_date || !appointment_time) return res.status(400).json({ error: 'Patient, doctor, date and time are required.' });
  try {
    const [p] = await pool.execute('SELECT patient_id FROM patients WHERE patient_id = ?', [Number(patient_id)]);
    const [d] = await pool.execute('SELECT doctor_id FROM doctors WHERE doctor_id = ?', [Number(doctor_id)]);
    if (!p.length || !d.length) return res.status(400).json({ error: 'Select an existing patient and doctor.' });
    let sql, params;
    if (await hasStatusColumn()) { sql = 'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status) VALUES (?, ?, ?, ?, ?)'; params = [Number(patient_id), Number(doctor_id), appointment_date, appointment_time, 'Pending']; }
    else { sql = 'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)'; params = [Number(patient_id), Number(doctor_id), appointment_date, appointment_time]; }
    const [result] = await pool.execute(sql, params);
    res.status(201).json({ message: 'Appointment booked successfully.', appointment_id: result.insertId, status: (await hasStatusColumn()) ? 'Pending' : 'Booked' });
  } catch (err) { errorResponse(res, err); }
});
app.get('/api/appointments', requireAuth, async (req, res) => {
  try {
    const statusExists = await hasStatusColumn();
    const statusSelect = statusExists ? 'a.status' : "'Booked' AS status";
    const [rows] = await pool.query(`SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time, ${statusSelect}, p.patient_name, d.doctor_name, d.specialization FROM appointments a JOIN patients p ON p.patient_id = a.patient_id JOIN doctors d ON d.doctor_id = a.doctor_id ORDER BY a.appointment_date DESC, a.appointment_time DESC`);
    res.json({ rows, statusColumnAvailable: statusExists });
  } catch (err) { errorResponse(res, err); }
});
app.patch('/api/appointments/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) return res.status(400).json({ error: 'Status must be Pending, Confirmed or Cancelled.' });
  try {
    if (!(await hasStatusColumn())) return res.status(409).json({ error: 'Your current appointments table has no status column. If you want status updates like the Java project, run the optional SQL in database/add_status_column.sql in MySQL Workbench, then refresh.' });
    const [result] = await pool.execute('UPDATE appointments SET status = ? WHERE appointment_id = ?', [status, Number(req.params.id)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Appointment not found.' });
    res.json({ message: `Appointment marked ${status.toLowerCase()}.` });
  } catch (err) { errorResponse(res, err); }
});
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Unexpected server error.' }); });
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Hospital Appointment API running on port ${port}`));
