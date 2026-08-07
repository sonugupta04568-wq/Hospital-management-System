/* =========================================================
   MediCare Hospital Management System - APP LOGIC
   Views: Dashboard, Doctors, Schedule, Appointments,
   Patients, Hospital/Contact.
   ========================================================= */

// ---------- Database ----------
let DB = initDB();

function saveDB(db) {
    db = db || DB;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getDoctors()   { return DB.doctors; }
function getPatients()  { return DB.patients; }
function getAppts()     { return DB.appointments; }
function getDoctor(id)  { return DB.doctors.find(d => d.id === id); }

// ---------- Helpers ----------
function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toDateString();
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function initials(name) {
    return name.replace(/[^a-zA-Z ]/g, '').trim()
        .split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function modeBadge(mode) {
    return mode === 'online'
        ? '<span class="mode online">&#128247; Online</span>'
        : '<span class="mode offline">&#128678; Offline</span>';
}

function toast(msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.borderLeftColor = isError ? '#b71c1c' : '#d32f2f';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- VIEW ROUTER ----------
function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + name);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav a').forEach(a => {
        a.classList.toggle('active', a.dataset.view === name);
    });
    document.getElementById('hero').style.display = (name === 'dashboard' || name === 'hospital') ? 'block' : 'none';

    if (name === 'dashboard') renderDashboard();
    if (name === 'doctors') renderDoctors();
    if (name === 'schedule') renderSchedulePage();
    if (name === 'appointments') renderAppointmentsPage();
    if (name === 'patients') renderPatientsPage();
    if (name === 'hospital') renderHospitalPage();
    window.scrollTo({ top: 0 });
}

// ---------- DASHBOARD ----------
function renderDashboard() {
    document.getElementById('stat-doctors').textContent = DB.doctors.length;
    document.getElementById('stat-patients').textContent = DB.patients.length;
    document.getElementById('stat-appointments').textContent = DB.appointments.length;
    const today = todayStr();
    const todays = DB.appointments.filter(a => a.date === today);
    document.getElementById('stat-today').textContent = todays.length;
    document.getElementById('stat-departments').textContent =
        new Set(DB.doctors.map(d => d.department)).size;

    // Today's shifts
    const box = document.getElementById('dashboard-shifts');
    const day = new Date().getDay();
    const onDuty = DB.doctors.filter(d => (d.schedule[day] || 'off') !== 'off');

    box.innerHTML = onDuty.length
        ? onDuty.map(d => `
            <div class="list-item">
                <div class="li-main">
                    <b>${esc(d.name)}</b>
                    <div>${esc(d.specialty)} &middot; ${esc(d.department)}</div>
                </div>
                <span class="badge ${d.schedule[day]}">${esc(getShiftLabel(d.schedule[day]))}</span>
            </div>`).join('')
        : '<div class="empty">No doctors on duty today.</div>';

    // Upcoming appointments
    const upcoming = [...DB.appointments]
        .filter(a => a.status !== 'cancelled')
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 5);

    document.getElementById('dashboard-appointments').innerHTML = upcoming.length
        ? upcoming.map(a => {
            const doc = getDoctor(a.doctorId);
            return `
            <div class="list-item">
                <div class="li-main">
                    <b>${esc(a.patientName)}</b>
                    <div>${esc(doc ? doc.name : 'Doctor')} &middot; ${esc(formatDate(a.date))} at ${esc(a.time)} &middot; ${modeBadge(a.mode)}</div>
                </div>
                <span class="status ${a.status}">${esc(a.status)}</span>
            </div>`;
        }).join('')
        : '<div class="empty">No upcoming appointments.</div>';
}

// ---------- DOCTORS ----------
function renderDoctors() {
    // Fill department filter once
    const deptFilter = document.getElementById('doctor-dept-filter');
    if (deptFilter.options.length <= 1) {
        const depts = [...new Set(DB.doctors.map(d => d.department))].sort();
        depts.forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept;
            opt.textContent = dept;
            deptFilter.appendChild(opt);
        });
    }

    const q = document.getElementById('doctor-search').value.trim().toLowerCase();
    const dept = document.getElementById('doctor-dept-filter').value;
    const list = DB.doctors.filter(d => {
        const matchQ = !q ||
            (d.name + d.specialty + d.department + d.email).toLowerCase().includes(q);
        const matchD = !dept || d.department === dept;
        return matchQ && matchD;
    });

    const grid = document.getElementById('doctors-grid');
    grid.innerHTML = list.length ? list.map(d => `
        <div class="doctor-card">
            <div class="doctor-head">
                <div class="doctor-avatar">${esc(initials(d.name))}</div>
                <div>
                    <h4>${esc(d.name)}</h4>
                    <div class="spec">${esc(d.specialty)}</div>
                </div>
            </div>
            <div class="doctor-body">
                <p><b>Department:</b> ${esc(d.department)}</p>
                <p><b>Experience:</b> ${esc(typeof d.experience === 'number' ? d.experience + ' years' : d.experience)}</p>
                <p><b>Qualification:</b> ${esc(d.qualification)}</p>
                <p><b>Consultation Fee:</b> &#8377;${d.fee}</p>
                <p><b>Phone:</b> <a href="tel:${esc(d.phone)}">${esc(d.phone)}</a></p>
                <p><b>Email:</b> <a href="mailto:${esc(d.email)}">${esc(d.email)}</a></p>
                <span class="dept-tag red">${esc(d.department)}</span>
                <span class="dept-tag">${esc(d.specialty)}</span>
            </div>
            <div class="doctor-actions">
                <button class="btn btn-danger btn-small" onclick="bookForDoctor('${d.id}')">Book</button>
                <a class="btn btn-gray btn-small" href="tel:${esc(d.phone)}">Call</a>
                <a class="btn btn-gray btn-small" href="mailto:${esc(d.email)}">Email</a>
            </div>
        </div>`).join('')
        : '<div class="empty">No doctors match your search.</div>';
}

// ---------- SCHEDULE ----------
function fillScheduleDoctorSelect() {
    const sel = document.getElementById('schedule-doctor');
    sel.innerHTML = DB.doctors.map(d =>
        `<option value="${d.id}">${esc(d.name)} (${esc(d.department)})</option>`).join('');
}

function renderSchedulePage() {
    const sel = document.getElementById('schedule-doctor');
    if (sel.options.length === 0) fillScheduleDoctorSelect();
    const dateInput = document.getElementById('schedule-date');
    if (!dateInput.value) dateInput.value = todayStr();
    renderScheduleDetail(sel.value, dateInput.value);
}

function renderScheduleDetail(doctorId, dateStr) {
    const doc = getDoctor(doctorId);
    if (!doc) return;
    const summary = document.getElementById('schedule-summary');
    const rosterBox = document.getElementById('weekly-roster');

    if (!dateStr) {
        summary.innerHTML = '<div class="empty">Select a date to see the shift.</div>';
        rosterBox.innerHTML = '';
        return;
    }

    const shift = getShiftDay(doc, dateStr);
    const slots = generateSlotsFor(doc, dateStr);
    summary.innerHTML = `
        <div class="shift-line">
            <b>${esc(doc.name)}</b><br>
            ${esc(doc.specialty)} · ${esc(doc.department)}
        </div>
        <div class="shift-line">
            <b>Date:</b> ${esc(formatDate(dateStr))} (${esc(WEEKDAYS[new Date(dateStr + 'T12:00:00').getDay()])})
        </div>
        <div class="shift-line">
            <b>Shift:</b> <span class="badge ${shift}">${esc(getShiftLabel(shift))}</span>
        </div>
        <div class="shift-line">
            <b>Available slots:</b> ${slots.length ? slots.join(' · ') : 'None — day off'}
        </div>`;

    // Weekly roster
    const d = new Date(dateStr + 'T12:00:00');
    let html = '';
    for (let i = 0; i < 7; i++) {
        const day = new Date(d);
        day.setDate(d.getDate() - d.getDay() + i);
        const ds = day.getFullYear() + '-' +
            String(day.getMonth() + 1).padStart(2, '0') + '-' +
            String(day.getDate()).padStart(2, '0');
        const shift = getShiftDay(doc, ds);
        const isToday = ds === todayStr();
        html += `
            <div class="roster-day${isToday ? ' today' : ''}" data-date="${ds}">
                <span class="dow">${WEEKDAYS[i].slice(0, 3)}</span>
                <span>${isToday ? 'Today' : WEEKDAYS[i]}</span>
                <span class="badge ${shift}">${esc(getShiftLabel(shift))}</span>
            </div>`;
    }
    rosterBox.innerHTML = html;

    // Click a roster day to view it
    rosterBox.querySelectorAll('.roster-day').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            document.getElementById('schedule-date').value = row.dataset.date;
            renderScheduleDetail(doctorId, row.dataset.date);
        });
    });
}

// ---------- APPOINTMENTS ----------
let selectedSlot = null;

function fillApptSelects() {
    const deptSel = document.getElementById('appt-dept');
    const depts = [...new Set(DB.doctors.map(d => d.department))].sort();
    deptSel.innerHTML = '<option value="">-- Select Department --</option>' +
        depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    filterDoctorsByDept();
}

function filterDoctorsByDept() {
    const dept = document.getElementById('appt-dept').value;
    const docSel = document.getElementById('appt-doctor');
    docSel.innerHTML = '<option value="">-- Select Doctor --</option>' +
        DB.doctors
            .filter(d => !dept || d.department === dept)
            .map(d => `<option value="${d.id}">${esc(d.name)} (${esc(d.specialty)})</option>`)
            .join('');
    clearSlotPicker();
    showRandomDoctorInfo();
}

function clearSlotPicker() {
    document.getElementById('slot-picker').innerHTML =
        '<span class="muted">Choose a doctor &amp; date to see available slots.</span>';
    selectedSlot = null;
}

function renderSlotPicker() {
    const doctorId = document.getElementById('appt-doctor').value;
    const dateStr = document.getElementById('appt-date').value;
    const picker = document.getElementById('slot-picker');

    if (!doctorId || !dateStr) { clearSlotPicker(); return; }

    const doc = getDoctor(doctorId);
    const shift = getShiftDay(doc, dateStr);
    if (shift === 'off') {
        picker.innerHTML = '<span class="muted">Doctor is OFF on this date. Choose another day.</span>';
        selectedSlot = null;
        return;
    }

    const slots = generateSlotsFor(doc, dateStr);
    const taken = new Set(DB.appointments
        .filter(a => a.doctorId === doctorId && a.date === dateStr && a.status !== 'cancelled')
        .map(a => a.time));

    const isPast = dateStr < todayStr();
    picker.innerHTML = `
        <div style="width:100%"><span class="badge ${shift}">${esc(getShiftLabel(shift))}</span>
        <span class="muted" style="font-size:.8rem"> Select your slot:</span></div>
        ` + slots.map(s => {
            const disabled = taken.has(s);
            return `<span class="slot ${selectedSlot === s ? 'selected' : ''} ${disabled || isPast ? 'taken' : ''}"
                    ${disabled || isPast ? '' : `onclick="selectSlot('${s}')"`}>${s}</span>`;
        }).join('');
    if (selectedSlot && taken.has(selectedSlot)) selectedSlot = null;
}

function selectSlot(time) {
    selectedSlot = time;
    renderSlotPicker();
}

function bookForDoctor(doctorId) {
    showView('appointments');
    document.getElementById('appt-dept').value =
        getDoctor(doctorId).department;
    filterDoctorsByDept();
    document.getElementById('appt-doctor').value = doctorId;
    showRandomDoctorInfo();
    document.getElementById('appt-date').value = daysFromNow(0);
    renderSlotPicker();
    toast('Selected doctor ' + getDoctor(doctorId).name);
}

function showRandomDoctorInfo() {
    const info = document.getElementById('random-doctor-info');
    const id = document.getElementById('appt-doctor').value;
    const doc = id ? getDoctor(id) : null;
    info.innerHTML = doc
        ? `Selected doctor: <b>${esc(doc.name)}</b> &middot; ${esc(doc.specialty)} &middot; <a href="tel:${esc(doc.phone)}">${esc(doc.phone)}</a>`
        : '';
}

function pickRandomDoctor() {
    const now = new Date();
    const day = now.getDay();
    const available = DB.doctors.filter(d => (d.schedule[day] || 'off') !== 'off');
    const pool = available.length ? available : DB.doctors;
    const doc = pool[Math.floor(Math.random() * pool.length)];

    document.getElementById('appt-dept').value = doc.department;
    filterDoctorsByDept();
    document.getElementById('appt-doctor').value = doc.id;
    if (!document.getElementById('appt-date').value) {
        document.getElementById('appt-date').value = daysFromNow(0);
    }
    renderSlotPicker();
    showRandomDoctorInfo();
    toast('Random doctor attached: ' + doc.name + ' (' + doc.specialty + ') — phone ' + doc.phone);
}

function handleAppointmentSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('appt-name').value.trim();
    const gender = document.getElementById('appt-gender').value;
    const phone = document.getElementById('appt-phone').value.trim();
    const email = document.getElementById('appt-email').value.trim();
    const doctorId = document.getElementById('appt-doctor').value;
    const dateStr = document.getElementById('appt-date').value;
    const mode = document.getElementById('appt-mode').value;
    const reason = document.getElementById('appt-reason').value.trim();

    if (!name || !phone || !email || !gender || !doctorId || !dateStr) {
        toast('Please fill all required fields including gender and doctor.', true);
        return;
    }
    if (!selectedSlot) {
        toast('Please pick a time slot.', true);
        return;
    }

    const doc = getDoctor(doctorId);
    const appt = {
        id: makeId('APT'),
        patientName: name,
        gender: gender,
        phone: phone,
        email: email,
        doctorId: doctorId,
        doctorName: doc.name,
        doctorPhone: doc.phone,
        doctorEmail: doc.email,
        department: doc.department,
        date: dateStr,
        time: selectedSlot,
        mode: mode || 'offline',
        status: 'confirmed',
        reason: reason || 'General consultation'
    };

    // Register in patient database if new
    if (!DB.patients.find(p => p.name.toLowerCase() === name.toLowerCase() && p.phone === phone)) {
        DB.patients.push({
            id: makeId('P'),
            name: name,
            phone: phone,
            email: email,
            gender: gender,
            blood: 'Unknown',
            age: ''
        });
    }

    DB.appointments.push(appt);
    saveDB();
    renderAppointmentsPage();
    toast('Appointment confirmed! ' + formatDate(dateStr) + ' at ' + selectedSlot);
    e.target.reset();
    fillApptSelects();
    selectedSlot = null;
}

function renderAppointmentsPage() {
    const list = document.getElementById('appointments-list');
    const q = document.getElementById('appt-search').value.trim().toLowerCase();

    if (document.getElementById('appt-dept').options.length === 0) fillApptSelects();
    const appts = DB.appointments
        .filter(a =>
            !q ||
            (a.patientName + a.department + a.phone + a.doctorId).toLowerCase().includes(q))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    list.innerHTML = appts.length ? appts.map(a => {
        const doc = getDoctor(a.doctorId);
        const docName = (a.doctorName || (doc ? doc.name : ''));
        const docPhone = (a.doctorPhone || (doc ? doc.phone : ''));
        const docEmail = (a.doctorEmail || (doc ? doc.email : ''));
        return `
        <div class="list-item">
            <div class="li-main">
                <b>${esc(a.patientName)}</b> <span class="muted">${esc(a.gender || '')}</span>
                <div>${esc(docName)} · ${esc(a.department)} · ${modeBadge(a.mode)}</div>
                <div>${esc(formatDate(a.date))} at ${esc(a.time)} · ${esc(a.phone)}</div>
                <div class="muted">${esc(a.reason)}</div>
                ${docPhone ? `<div class="doc-attach">
                    <a href="tel:${esc(docPhone)}">&#128222; ${esc(docPhone)}</a>
                    &nbsp;<a href="mailto:${esc(docEmail)}">&#9993; ${esc(docEmail)}</a>
                </div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                <span class="status ${a.status}">${esc(a.status)}</span>
                ${a.status === 'confirmed' ? `
                    <button class="btn btn-small btn-gray" onclick="completeAppt('${a.id}')">Complete</button>
                    <button class="btn btn-small btn-danger" onclick="cancelAppt('${a.id}')">Cancel</button>` : ''}
            </div>
        </div>`;
    }).join('') : '<div class="empty">No appointments found.</div>';
}

function completeAppt(id) {
    const a = DB.appointments.find(x => x.id === id);
    if (!a) return;
    a.status = 'completed';
    saveDB();
    renderAppointmentsPage();
    renderDashboard();
    toast('Appointment marked as completed.');
}

function cancelAppt(id) {
    const a = DB.appointments.find(x => x.id === id);
    if (!a) return;
    a.status = 'cancelled';
    saveDB();
    renderAppointmentsPage();
    renderDashboard();
    toast('Appointment cancelled. Slot is freed.');
}

// ---------- PATIENTS ----------
function renderPatientsPage() {
    const q = document.getElementById('patient-search').value.trim().toLowerCase();
    const tbody = document.getElementById('patients-tbody');
    const list = DB.patients.filter(p =>
        !q || (p.name + p.phone + p.email + p.id).toLowerCase().includes(q));

    tbody.innerHTML = list.map(p => {
        const count = DB.appointments
            .filter(a => a.patientName.toLowerCase() === p.name.toLowerCase() && a.status !== 'cancelled').length;
        return `<tr>
            <td>${esc(p.id)}</td>
            <td><b>${esc(p.name)}</b></td>
            <td>${esc(p.phone)}</td>
            <td>${esc(p.email)}</td>
            <td>${esc(p.blood)}</td>
            <td>${esc(p.age || '—')}</td>
            <td>${count}</td>
        </tr>`;
    }).join('');
}

// ---------- HOSPITAL / CONTACT ----------
function renderHospitalPage() {
    const box = document.getElementById('contact-doctors');
    box.innerHTML = DB.doctors.map(d => `
        <div class="list-item">
            <div class="li-main">
                <b>${esc(d.name)}</b>
                <div>${esc(d.specialty)} · ${esc(d.department)}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <a class="btn btn-small btn-gray" href="tel:${esc(d.phone)}">&#128222; ${esc(d.phone)}</a>
                <a class="btn btn-small btn-gray" href="mailto:${esc(d.email)}">&#9993; ${esc(d.email)}</a>
            </div>
        </div>`).join('');
}

// ---------- EVENT WIRING ----------
document.addEventListener('DOMContentLoaded', () => {
    // Nav routing
    document.querySelectorAll('.nav a').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            showView(a.dataset.view);
        });
    });
    document.querySelectorAll('[data-goto]').forEach(b => {
        b.addEventListener('click', () => showView(b.dataset.goto));
    });
    document.getElementById('btn-book-now').addEventListener('click', () => showView('appointments'));

    // Doctor search/filter
    document.getElementById('doctor-search').addEventListener('input', renderDoctors);
    document.getElementById('doctor-dept-filter').addEventListener('change', renderDoctors);

    // Schedule
    document.getElementById('schedule-doctor').addEventListener('change', e => {
        renderScheduleDetail(e.target.value, document.getElementById('schedule-date').value);
    });
    document.getElementById('schedule-date').addEventListener('change', e => {
        renderScheduleDetail(document.getElementById('schedule-doctor').value, e.target.value);
    });

    // Appointments form
    document.getElementById('appt-dept').addEventListener('change', filterDoctorsByDept);
    document.getElementById('appt-doctor').addEventListener('change', () => {
        renderSlotPicker();
        showRandomDoctorInfo();
    });
    document.getElementById('appt-date').addEventListener('change', renderSlotPicker);
    document.getElementById('btn-random-doctor').addEventListener('click', pickRandomDoctor);
    document.getElementById('appointment-form').addEventListener('submit', handleAppointmentSubmit);
    document.getElementById('appt-search').addEventListener('input', renderAppointmentsPage);

    // Patients
    document.getElementById('patient-search').addEventListener('input', renderPatientsPage);

    // Initialize
    const today = todayStr();
    document.getElementById('appt-date').min = today;
    document.getElementById('schedule-date').min = today;

    showView('dashboard');
});