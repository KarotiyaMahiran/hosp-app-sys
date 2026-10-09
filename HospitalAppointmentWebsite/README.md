# MediCare — Hospital Appointment Management System

A responsive web version of the Java Swing project in the supplied PDF. It keeps the same main workflow: admin login, dashboard, Doctor Management, Patient Management, Book Appointment, View Appointments. The backend uses the existing MySQL database `hospital_db` and the column names confirmed from your MySQL Workbench output.

## Important: what is included

- `frontend/` — static HTML/CSS/JavaScript website. This is the folder to deploy to Netlify.
- `backend/` — Express API that connects to MySQL. This runs locally for testing and must be deployed separately for a public Netlify site to use it.
- `database/add_status_column.sql` — OPTIONAL SQL only if you want Pending / Confirmed / Cancelled appointment statuses. Your current `appointments` table has five columns and does not include `status`, so status updates are not available until you choose to add this column.

## Your confirmed existing schema

- `doctors`: `doctor_id`, `doctor_name`, `specialization`, `phone`
- `patients`: `patient_id`, `patient_name`, `age`, `gender`, `phone`
- `appointments`: `appointment_id`, `patient_id`, `doctor_id`, `appointment_date`, `appointment_time`

The website does not create or drop these tables. It uses parameterized SQL queries to read and save records.

## A. Run it locally first (Windows)

1. Install Node.js LTS if needed: https://nodejs.org/
2. Open the `backend` folder in a terminal.
3. Run `npm install`.
4. Copy `.env.example` to a new file named `.env` in the same `backend` folder.
5. Edit `.env` with the credentials you use for your own MySQL `hospital_db`. Do not share or upload `.env` publicly. Set a long random `JWT_SECRET` and choose your own `ADMIN_PASSWORD`.
6. Keep MySQL Server running. In the backend terminal run `npm start`. You should see `Hospital Appointment API running on port 3000`.
7. Open a second terminal in the `frontend` folder and run `npx serve -l 5500 .` (or use any static server). Open the local URL printed by the command.
8. Log in with the username/password you set in backend `.env` (default username is `admin`; the password is whatever you set as `ADMIN_PASSWORD`).

If the API reports a database connection error, check that MySQL Server is running, `DB_HOST` is reachable, `DB_PORT` is correct, the database is `hospital_db`, and the credentials are correct. MySQL Workbench is a client; it is not the database server itself.

## B. Deploy the frontend to Netlify

1. First deploy the backend API to a Node.js host that supports long-running Express apps (for example, Render Web Service). Add the environment variables from `.env.example` in that service's settings. Do not upload your `.env` file.
2. **Your MySQL database must be reachable from that deployed backend.** A MySQL server running only on your own PC at `localhost` cannot be reached by Netlify or Render. You need a hosted/reachable MySQL server and must configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for it. Keep the existing table/column schema when moving/importing the database. Do not expose MySQL port 3306 to everyone; use provider IP allowlists/private networking and a restricted database user when available.
3. In `frontend/config.js`, replace `http://localhost:3000/api` with your deployed backend URL ending in `/api`, for example `https://YOUR-BACKEND.onrender.com/api`.
4. In the backend host's environment variables, set `FRONTEND_ORIGIN` to your exact Netlify site origin, for example `https://YOUR-SITE.netlify.app` (no path). If you use a custom domain, include that origin too, comma-separated.
5. Upload the **contents of the `frontend` folder** to Netlify's manual deploy / deploy-drop area, or connect the folder through Git. Netlify publishes this folder; it does not run the MySQL backend.
6. Open the deployed site and test login, add doctor, add patient, book appointment, and view appointments.

## Appointment status option

Your Workbench output lists five fields in `appointments`, with no `status`. The project PDF includes appointment status updates. If you want that extra feature, review `database/add_status_column.sql` and run it in MySQL Workbench only if you approve the schema change. It adds one nullable-purpose workflow column with default `Pending` and leaves existing rows/tables intact. Afterward, the website enables the status dropdown automatically.

## Security notes

- Change the demo/default admin password before sharing the site.
- Never commit `.env` or paste database passwords into chats/screenshots.
- Do not use a public database user with broad administrative permissions for the deployed website.
- This is a student project starter, not a production clinical system; add stronger role management, audit logs, backups and privacy controls before real patient use.
