/* =========================================================
   MediCare Hospital Management System - DATA LAYER
   Seed hospital database: hospitals, departments, doctors,
   shift-wise schedules, patients. Stored in localStorage.
   ========================================================= */

const STORAGE_KEY = 'medicare_db_v3';

const HOSPITAL_INFO = {
    name: 'MediCare Super Speciality Hospital',
    emergency: '+91 98765 43210',
    helpline: '1800-987-6543',
    appointmentPhone: '+91 91234 56780',
    reception: '+91 9120 000 000',
    email: 'care@medicare.in',
    appointmentsEmail: 'appointments@medicare.in',
    locations: [
        { name: 'Main Campus', address: '12, Health Avenue, MG Road, Indore, MP - 452001' },
        { name: 'City Branch', address: '45, Green Park, Vijay Nagar, Indore, MP - 452010' },
        { name: 'North Wing', address: '8, Ring Road, Bhopal, MP - 462001' }
    ],
    openingHours: {
        'Emergency / ICU': 'Open 24 x 7, all year',
        'Ambulance': 'Available 24 x 7',
        'Pharmacy': 'Open 24 x 7',
        'OPD': 'Mon - Sat, 8:00 AM - 8:00 PM (Sun 10 AM - 2 PM)',
        'Laboratory': '7:00 AM - 10:00 PM'
    },
    consultationOptions: [
        'Offline - Visit the hospital in person',
        'Online - Video / phone consultation from home'
    ],
    shiftsTiming: {
        'Morning': '8:00 AM - 2:00 PM',
        'Evening': '2:00 PM - 8:00 PM',
        'Night': '8:00 PM - 8:00 AM'
    }
};

// Shift-wise schedule template per weekday (0=Sunday .. 6=Saturday)
// A doctor can be 'morning' | 'evening' | 'night' | 'off'
const DEFAULT_DOCTORS = [
    {
        id: 'D001',
        name: 'Dr. Rajesh Sharma',
        specialty: 'General Physician',
        department: 'General Medicine',
        experience: 18,
        qualification: 'MBBS, MD (Medicine)',
        phone: '+91 90011 11101',
        email: 'rajesh.sharma@medicare.in',
        fee: 600,
        schedule: { 6: 'morning', 0: 'off', 1: 'morning', 2: 'evening', 3: 'morning', 4: 'evening', 5: 'morning' }
    },
    {
        id: 'D002',
        name: 'Dr. Priya Verma',
        specialty: 'Cardiologist',
        department: 'Cardiology',
        experience: '12 years',
        qualification: 'MBBS, MD (Cardiology)',
        phone: '+91 98711 22202',
        email: 'priya.verma@medicare.in',
        fee: 900,
        schedule: { 0: 'off', 1: 'morning', 2: 'morning', 3: 'night', 4: 'morning', 5: 'evening', 6: 'morning' }
    },
    {
        id: 'D003',
        name: 'Dr. Arjun Mehta',
        specialty: 'Orthopedic Surgeon',
        department: 'Orthopedics',
        experience: '15 years',
        qualification: 'MBBS, MS (Ortho)',
        phone: '+91 98711 33303',
        email: 'arjun.mehta@medicare.in',
        fee: 700,
        schedule: { 0: 'off', 1: 'evening', 2: 'morning', 3: 'evening', 4: 'off', 5: 'morning', 6: 'evening' }
    },
    {
        id: 'D004',
        name: 'Dr. Kavita Nair',
        specialty: 'Pediatrician',
        department: 'Pediatrics',
        experience: '9 years',
        qualification: 'MBBS, MD (Pediatrics)',
        phone: '+91 98711 44404',
        email: 'kavita.nair@medicare.in',
        fee: 500,
        schedule: { 0: 'off', 1: 'morning', 2: 'evening', 3: 'morning', 4: 'evening', 5: 'morning', 6: 'off' }
    },
    {
        id: 'D005',
        name: 'Dr. Vikram Singh',
        specialty: 'Neurologist',
        department: 'Neurology',
        experience: '18 years',
        qualification: 'MBBS, MD (Neurology)',
        phone: '+91 98711 55505',
        email: 'vikram.singh@medicare.in',
        fee: 1000,
        schedule: { 0: 'off', 1: 'off', 2: 'night', 3: 'morning', 4: 'evening', 5: 'morning', 6: 'evening' }
    },
    {
        id: 'D006',
        name: 'Dr. Meera Reddy',
        specialty: 'Dermatologist',
        department: 'Dermatology',
        experience: '7 years',
        qualification: 'MBBS, MD (Dermatology)',
        phone: '+91 98711 66606',
        email: 'meera.reddy@medicare.in',
        fee: 550,
        schedule: { 0: 'off', 1: 'evening', 2: 'morning', 3: 'off', 4: 'morning', 5: 'evening', 6: 'morning' }
    },
    {
        id: 'D007',
        name: 'Dr. Amit Joshi',
        specialty: 'Gynecologist',
        department: 'Gynecology & Obstetrics',
        experience: '11 years',
        qualification: 'MBBS, MS (OBG)',
        phone: '+91 98711 77707',
        email: 'amit.joshi@medicare.in',
        fee: 800,
        schedule: { 0: 'off', 1: 'morning', 2: 'evening', 3: 'morning', 4: 'evening', 5: 'off', 6: 'morning' }
    },
    {
        id: 'D008',
        name: 'Dr. Sunita Kulkarni',
        specialty: 'ENT Specialist',
        department: 'ENT (Ear Nose Throat)',
        experience: '10 years',
        qualification: 'MBBS, MS (ENT)',
        phone: '+91 98711 88808',
        email: 'sunita.kulkarni@medicare.in',
        fee: 450,
        schedule: { 0: 'off', 1: 'off', 2: 'evening', 3: 'evening', 4: 'morning', 5: 'morning', 6: 'evening' }
    }
];

const SEED_PATIENTS = [
    { id: 'P1001', name: 'Rahul Sharma', phone: '+91 98230 10001', email: 'rahul.s@gmail.com', blood: 'B+', age: 34, gender: 'Male' },
    { id: 'P1002', name: 'Sneha Patel', phone: '+91 98230 10002', email: 'sneha.p@yahoo.com', blood: 'O+', age: 28, gender: 'Female' },
    { id: 'P1003', name: 'Mohammed Ali', phone: '+91 98230 10003', email: 'ali.m@gmail.com', blood: 'A+', age: 45, gender: 'Male' },
    { id: 'P1004', name: 'Anjali Gupta', phone: '+91 98230 10004', email: 'anjali.g@outlook.com', blood: 'AB+', age: 22, gender: 'Female' },
    { id: 'P1005', name: 'Suresh Kumar', phone: '+91 98230 10005', email: 'suresh.k@gmail.com', blood: 'O-', age: 51, gender: 'Male' },
    { id: 'P1006', name: 'Neha Jain', phone: '+91 98230 10006', email: 'neha.j@medicare.in', blood: 'B-', age: 31, gender: 'Female' },
    { id: 'P1007', name: 'Deepak Yadav', phone: '+91 98230 10007', email: 'deepak.y@gmail.com', blood: 'A-', age: 39, gender: 'Male' },
    { id: 'P1008', name: 'Farah Khan', phone: '+91 98230 10008', email: 'farah.k@medicare.in', blood: 'O+', age: 27, gender: 'Female' }
];

const SEED_APPOINTMENTS = [
    {
        id: 'APT-1001',
        patientName: 'Rahul Sharma',
        gender: 'Male',
        phone: '+91 98765 10001',
        email: 'rahul.s@gmail.com',
        doctorId: 'D001',
        doctorName: 'Dr. Rajesh Sharma',
        doctorPhone: '+91 90011 11101',
        doctorEmail: 'rajesh.sharma@medicare.in',
        department: 'General Medicine',
        date: '2026-08-07',
        time: '9:00 AM',
        status: 'confirmed',
        mode: 'offline',
        reason: 'Fever and cold since 3 days'
    },
    {
        id: 'APT-1002',
        patientName: 'Anjali Gupta',
        gender: 'Female',
        phone: '+91 98230 10004',
        email: 'anjali.g@outlook.com',
        doctorId: 'D002',
        doctorName: 'Dr. Priya Verma',
        doctorPhone: '+91 98711 22202',
        doctorEmail: 'priya.verma@medicare.in',
        department: 'Cardiology',
        date: '2026-08-07',
        time: '11:30 AM',
        status: 'confirmed',
        mode: 'online',
        reason: 'Routine heart checkup'
    },
    {
        id: 'APT-1003',
        patientName: 'Mohammed Ali',
        gender: 'Male',
        phone: '+91 98230 10003',
        email: 'ali.m@gmail.com',
        doctorId: 'D003',
        doctorName: 'Dr. Arjun Mehta',
        doctorPhone: '+91 98711 33303',
        doctorEmail: 'arjun.mehta@medicare.in',
        department: 'Orthopedics',
        date: '2026-08-08',
        time: '10:00 AM',
        status: 'completed',
        mode: 'offline',
        reason: 'Knee pain consultation'
    },
    {
        id: 'APT-1004',
        patientName: 'Farah Khan',
        gender: 'Female',
        phone: '+91 98230 10008',
        email: 'farah.k@gmail.com',
        doctorId: 'D004',
        doctorName: 'Dr. Kavita Nair',
        doctorPhone: '+91 98711 44404',
        doctorEmail: 'kavita.nair@medicare.in',
        department: 'Pediatrics',
        date: '2026-08-08',
        time: '4:00 PM',
        status: 'confirmed',
        mode: 'offline',
        reason: 'Child vaccination'
    }
];

/* Slot generation: 30-minute slots within a shift (minutes) */
const SHIFT_SLOTS = {
    morning: { start: 8 * 60, end: 14 * 60, label: 'Morning  (8:00 AM - 2:00 PM)' },
    evening: { start: 14 * 60, end: 20 * 60, label: 'Evening  (2:00 PM - 8:00 PM)' },
    night:   { start: 20 * 60, end: 23.5 * 60, label: 'Night  (8:00 PM - 12:00 AM)' }
};

function to12h(minutes) {
    let h = Math.floor(minutes / 60);
    let m = minutes % 60;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return (h + ':' + (m < 10 ? '0' + m : m) + ' ' + suffix);
}

function getShiftDay(doctor, dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    return doctor.schedule[day] || 'off';
}

function generateSlotsFor(doctor, dateStr) {
    const shift = getShiftDay(doctor, dateStr);
    if (!shift || shift === 'off') return [];
    const cfg = SHIFT_SLOTS[shift];
    const slots = [];
    for (let t = cfg.start; t + 30 <= cfg.end; t += 30) {
        slots.push(to12h(t));
    }
    return slots;
}

function getShiftLabel(shift) {
    if (!shift || shift === 'off') return 'Off';
    return SHIFT_SLOTS[shift].label;
}

function makeId(prefix) {
    return prefix + '-' + Math.floor(1000 + Math.random() * 9000);
}

/* ---------- Database access ---------- */
function initDB() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
        try { return JSON.parse(existing); } catch (e) { /* corrupted -> reseed */ }
    }
    const db = {
        hospital: HOSPITAL_INFO,
        doctors: DEFAULT_DOCTORS,
        patients: SEED_PATIENTS,
        appointments: SEED_APPOINTMENTS
    };
    saveDB(db);
    return db;
}