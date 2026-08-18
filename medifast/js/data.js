/* =========================================================
   MediFast — Hospital Resource Database (sample/demo data)
   ========================================================= */

const DEPARTMENTS = [
    { id: 'emergency', name: 'Emergency (ED)', icon: '🚨', beds: 40, baseline: 68, staff: 14, waitBase: 22, weather: { rain: 0.22, heat: 0.18, cold: 0.10 }, kind: 'ward' },
    { id: 'icu', name: 'ICU', icon: '🫀', beds: 20, baseline: 78, staff: 12, waitBase: 30, weather: { rain: 0.04, heat: 0.04, cold: 0.06 }, kind: 'ward' },
    { id: 'general', name: 'General Ward', icon: '🛏️', beds: 60, baseline: 58, staff: 16, waitBase: 15, weather: { rain: 0.06, heat: 0.05, cold: 0.05 }, kind: 'ward' },
    { id: 'pediatric', name: 'Pediatric', icon: '🧸', beds: 30, baseline: 52, staff: 10, waitBase: 18, weather: { rain: 0.10, heat: 0.12, cold: 0.18 }, kind: 'ward' },
    { id: 'maternity', name: 'Maternity', icon: '🤱', beds: 35, baseline: 60, staff: 12, waitBase: 20, weather: { rain: 0.02, heat: 0.02, cold: 0.02 }, kind: 'ward' },
    { id: 'surgery', name: 'Surgery', icon: '🩺', beds: 45, baseline: 55, staff: 15, waitBase: 25, weather: { rain: 0.03, heat: 0.02, cold: 0.03 }, kind: 'ward' },
    { id: 'cardio', name: 'Cardiology', icon: '❤️', beds: 25, baseline: 62, staff: 10, waitBase: 28, weather: { rain: 0.04, heat: 0.14, cold: 0.16 }, kind: 'ward' },
    { id: 'ortho', name: 'Orthopedics', icon: '🦴', beds: 30, baseline: 50, staff: 11, waitBase: 24, weather: { rain: 0.16, heat: 0.06, cold: 0.08 }, kind: 'ward' },
    { id: 'ent', name: 'ENT', icon: '👂', beds: 15, baseline: 42, staff: 6, waitBase: 12, weather: { rain: 0.08, heat: 0.05, cold: 0.12 }, kind: 'ward' },
    { id: 'skin', name: 'Skin / Derm', icon: '🧴', beds: 20, baseline: 40, staff: 7, waitBase: 14, weather: { rain: 0.10, heat: 0.14, cold: 0.04 }, kind: 'ward' },
    { id: 'dental', name: 'Dental', icon: '🦷', beds: 10, baseline: 38, staff: 5, waitBase: 10, weather: { rain: 0.02, heat: 0.02, cold: 0.02 }, kind: 'ward' },
    { id: 'opd', name: 'OPD (Outpatient)', icon: '🚪', beds: 0, baseline: 72, staff: 18, waitBase: 35, weather: { rain: 0.05, heat: 0.05, cold: 0.05 }, kind: 'opd' },
];

/* Reasons for routing -> preferred departments (ordered by fit) */
const ROUTING = {
    fever:      ['opd', 'pediatric', 'emergency'],
    injury:     ['ortho', 'emergency', 'surgery'],
    chest:      ['cardio', 'emergency', 'icu'],
    preg:       ['maternity', 'opd'],
    child:      ['pediatric', 'emergency'],
    skin:       ['skin', 'opd'],
    dental:     ['dental', 'opd'],
    mental:     ['opd', 'emergency'],
    lab:        ['opd', 'general'],
};

/* =========================================================
   Multi-floor hospital map — each level has its own nodes
   'elev' = elevator / stairs connecting all floors
   ========================================================= */
const FLOORS = {
    1: {
        name: 'Ground Floor — Emergency & Critical',
        nodes: {
            recep:  { name: 'Reception',   x: 8,  y: 8 },
            triage: { name: 'Triage',      x: 38, y: 8 },
            er:     { name: 'Emergency',   x: 70, y: 8 },
            pharma: { name: 'Pharmacy',    x: 70, y: 42 },
            icu:    { name: 'ICU',         x: 38, y: 76 },
            canteen:{ name: 'Cafeteria',   x: 70, y: 76 },
            elev:   { name: 'Elevator / Stairs', x: 8, y: 76 },
        },
        paths: {
            recep:  ['triage', 'elev'],
            triage: ['recep', 'er', 'elev'],
            er:     ['triage', 'pharma', 'icu'],
            icu:    ['er', 'pharma', 'elev'],
            pharma: ['er', 'icu', 'canteen', 'elev'],
            canteen:['pharma'],
            elev:   ['recep', 'triage', 'icu', 'pharma'],
        },
    },
    2: {
        name: '1st Floor — Outpatient & Diagnostics',
        nodes: {
            opd:     { name: 'OPD',          x: 8,  y: 8 },
            lab:     { name: 'Lab',          x: 38, y: 8 },
            ward:    { name: 'Wards',        x: 70, y: 8 },
            pharma2: { name: 'Pharmacy',     x: 38, y: 42 },
            elev:    { name: 'Elevator / Stairs', x: 70, y: 76 },
        },
        paths: {
            opd:     ['lab', 'pharma2', 'elev'],
            lab:     ['opd', 'ward', 'pharma2', 'elev'],
            ward:    ['lab', 'pharma2', 'elev'],
            pharma2: ['opd', 'lab', 'ward', 'elev'],
            elev:    ['opd', 'lab', 'ward', 'pharma2'],
        },
    },
    3: {
        name: '2nd Floor — Specialty Wards',
        nodes: {
            ped:    { name: 'Pediatric',  x: 8,  y: 8 },
            mat:    { name: 'Maternity',  x: 70, y: 8 },
            cardio: { name: 'Cardiology', x: 38, y: 42 },
            ortho:  { name: 'Orthopedics',x: 8,  y: 76 },
            ent:    { name: 'ENT / Skin / Dental', x: 70, y: 76 },
            elev:   { name: 'Elevator / Stairs',   x: 38, y: 76 },
        },
        paths: {
            ped:    ['cardio', 'elev'],
            mat:    ['cardio', 'elev'],
            cardio: ['ped', 'mat', 'ortho', 'ent', 'elev'],
            ortho:  ['cardio', 'elev'],
            ent:    ['cardio', 'elev'],
            elev:   ['ped', 'mat', 'cardio', 'ortho', 'ent'],
        },
    },
};

/* Department -> which floor + which node it lives on */
const DEPT_LOC = {
    emergency: { level: 1, node: 'er' },
    icu:       { level: 1, node: 'icu' },
    general:   { level: 2, node: 'ward' },
    surgery:   { level: 2, node: 'ward' },
    opd:       { level: 2, node: 'opd' },
    pediatric: { level: 3, node: 'ped' },
    maternity: { level: 3, node: 'mat' },
    cardio:    { level: 3, node: 'cardio' },
    ortho:     { level: 3, node: 'ortho' },
    ent:       { level: 3, node: 'ent' },
    skin:      { level: 3, node: 'ent' },
    dental:    { level: 3, node: 'ent' },
};

/* Hindi translations for voice responses */
const HI = {
    beds: 'इस समय अस्पताल में {free} बिस्तर खाली हैं।',
    beds_dept: '{dept} में {free} बिस्तर खाली हैं।',
    wait: '{dept} में अनुमानित प्रतीक्षा समय {wait} मिनट है।',
    load: '{dept} में भीड़ {load} प्रतिशत है, स्थिति {status} है।',
    overload: 'सावधान! {dept} में भीड़ बहुत अधिक है।',
    route: 'आपके लिए सबसे अच्छा विभाग {dept} है। कृपया रिसेप्शन से शुरू करें।',
    help: 'आप पूछ सकते हैं — कितने बिस्तर खाली हैं, प्रतीक्षा समय क्या है, या भीड़ कैसी है।',
    unknown: 'माफ़ कीजिए, मैं समझ नहीं पाया। कृपया बिस्तर, प्रतीक्षा या भीड़ के बारे में पूछें।',
    ready: 'मेडीफास्ट वॉइस असिस्टेंट तैयार है। बोलिए।',
    status_good: 'सामान्य', status_warn: 'अधिक', status_critical: 'गंभीर',
};

/* =========================================================
   EMERGENCY DISPATCH — hospital network + ambulance fleet
   ========================================================= */
const HOSPITAL_NETWORK = [
    /* ---- New Delhi ---- */
    { id: 'H001', name: 'AIIMS New Delhi',                 city: 'New Delhi',     lat: 28.5672, lng: 77.2100, icu: 20, general: 120, load: 78, spec: ['Trauma', 'Cardiology', 'Neurology', 'ICU'] },
    { id: 'H002', name: 'Safdarjung Hospital',             city: 'New Delhi',     lat: 28.5676, lng: 77.1986, icu: 15, general: 90,  load: 82, spec: ['Trauma', 'ICU', 'General'] },
    { id: 'H003', name: 'Sir Ganga Ram Hospital',          city: 'New Delhi',     lat: 28.6305, lng: 77.1963, icu: 12, general: 55,  load: 68, spec: ['Cardiology', 'Neurology', 'ICU'] },
    { id: 'H004', name: 'Lok Nayak Hospital',              city: 'New Delhi',     lat: 28.6284, lng: 77.2223, icu: 10, general: 80,  load: 74, spec: ['Trauma', 'ICU', 'General'] },
    { id: 'H005', name: 'Ram Manohar Lohia Hospital',      city: 'New Delhi',     lat: 28.6262, lng: 77.2120, icu: 14, general: 70,  load: 71, spec: ['Trauma', 'Cardiology', 'Neurology'] },
    /* ---- Noida ---- */
    { id: 'H006', name: 'Fortis Hospital Noida',           city: 'Noida',         lat: 28.5823, lng: 77.3230, icu: 18, general: 70,  load: 62, spec: ['Cardiology', 'ICU', 'Neurology'] },
    { id: 'H007', name: 'Jaypee Hospital',                 city: 'Noida',         lat: 28.6030, lng: 77.3500, icu: 16, general: 60,  load: 55, spec: ['Trauma', 'Cardiology', 'Neurology'] },
    { id: 'H008', name: 'Kailash Hospital',                city: 'Noida',         lat: 28.5733, lng: 77.3275, icu: 8,  general: 40,  load: 66, spec: ['Cardiology', 'General', 'ICU'] },
    { id: 'H009', name: 'Metro Hospitals & Heart Institute', city: 'Noida',       lat: 28.5860, lng: 77.3370, icu: 9,  general: 35,  load: 58, spec: ['Cardiology', 'Neurology'] },
    /* ---- Greater Noida ---- */
    { id: 'H010', name: 'Yatharth Super Speciality Hospital', city: 'Greater Noida', lat: 28.4775, lng: 77.4940, icu: 12, general: 50, load: 60, spec: ['Trauma', 'Cardiology', 'ICU'] },
    { id: 'H011', name: 'Sharda Hospital',                 city: 'Greater Noida', lat: 28.4660, lng: 77.5060, icu: 10, general: 45,  load: 64, spec: ['Trauma', 'ICU', 'General'] },
    { id: 'H012', name: 'Kailash Hospital',                city: 'Greater Noida', lat: 28.4790, lng: 77.5030, icu: 6,  general: 30,  load: 70, spec: ['Cardiology', 'General'] },
    /* ---- Ghaziabad ---- */
    { id: 'H013', name: 'Yashoda Hospital',                city: 'Ghaziabad',     lat: 28.6730, lng: 77.4380, icu: 11, general: 50,  load: 63, spec: ['Cardiology', 'ICU', 'General'] },
    { id: 'H014', name: 'Max Super Speciality Hospital Vaishali', city: 'Ghaziabad', lat: 28.6520, lng: 77.3350, icu: 15, general: 65, load: 57, spec: ['Cardiology', 'Neurology', 'ICU'] },
    { id: 'H015', name: 'Manipal Hospital Ghaziabad',      city: 'Ghaziabad',     lat: 28.6550, lng: 77.3380, icu: 12, general: 55,  load: 61, spec: ['Trauma', 'ICU', 'Cardiology'] },
    { id: 'H016', name: 'Navyug Hospital',                 city: 'Ghaziabad',     lat: 28.6640, lng: 77.4400, icu: 5,  general: 35,  load: 69, spec: ['General', 'Trauma'] },
    /* ---- Gurugram ---- */
    { id: 'H017', name: 'Medanta - The Medicity',          city: 'Gurugram',      lat: 28.4488, lng: 77.0738, icu: 25, general: 100, load: 72, spec: ['Trauma', 'Cardiology', 'Neurology', 'ICU'] },
    { id: 'H018', name: 'Artemis Hospital',                city: 'Gurugram',      lat: 28.4760, lng: 77.0980, icu: 20, general: 85,  load: 66, spec: ['Trauma', 'Cardiology', 'Neurology'] },
    { id: 'H019', name: 'Fortis Memorial Research Institute', city: 'Gurugram',   lat: 28.4720, lng: 77.1000, icu: 18, general: 80,  load: 59, spec: ['Cardiology', 'Neurology', 'ICU'] },
    /* ---- Faridabad ---- */
    { id: 'H020', name: 'Amrita Hospital',                 city: 'Faridabad',     lat: 28.4210, lng: 77.2840, icu: 22, general: 95,  load: 65, spec: ['Trauma', 'Cardiology', 'Neurology', 'ICU'] },
    { id: 'H021', name: 'Fortis Escorts Hospital Faridabad', city: 'Faridabad',   lat: 28.4050, lng: 77.3020, icu: 16, general: 60,  load: 67, spec: ['Cardiology', 'ICU', 'Trauma'] },
];

const AMBULANCES = [
    { id: 'A001', type: 'ALS', lat: 28.5660, lng: 77.2120, status: 'Available',  equip: ['Ventilator', 'ECG', 'Oxygen'] },
    { id: 'A002', type: 'BLS', lat: 28.5750, lng: 77.3290, status: 'Available',  equip: ['Oxygen', 'FirstAid'] },
    { id: 'A003', type: 'ALS', lat: 28.4490, lng: 77.0750, status: 'Busy',       equip: ['Ventilator', 'ECG', 'Oxygen'] },
    { id: 'A004', type: 'BLS', lat: 28.6720, lng: 77.4400, status: 'Available',  equip: ['Oxygen', 'FirstAid'] },
    { id: 'A005', type: 'ALS', lat: 28.4070, lng: 77.3000, status: 'Maintenance', equip: ['Ventilator', 'ECG', 'Oxygen'] },
];

const EMERGENCY_TYPES = {
    Accident:         { spec: 'Trauma',     icon: '💥' },
    HeartAttack:      { spec: 'Cardiology', icon: '💔' },
    BreathingProblem: { spec: 'ICU',        icon: '🫁' },
    Stroke:           { spec: 'Neurology',  icon: '🧠' },
    Fever:            { spec: 'General',    icon: '🤒' },
    Burn:             { spec: 'Trauma',     icon: '🔥' },
    Pregnancy:        { spec: 'Cardiology', icon: '🤰' },
};

const DEFAULT_REQUESTS = [
    { id: 'E001', name: 'Rahul', lat: 28.6700, lng: 77.4520, type: 'Accident',         severity: 'Critical', support: 'Trauma+ALS', status: 'Pending' },
    { id: 'E002', name: 'Priya', lat: 28.6600, lng: 77.4600, type: 'HeartAttack',      severity: 'Critical', support: 'Cardiology+ALS', status: 'Assigned' },
    { id: 'E003', name: 'Aman',  lat: 28.6750, lng: 77.4450, type: 'Accident',         severity: 'High',     support: 'Trauma+BLS', status: 'Pending' },
    { id: 'E004', name: 'Neha',  lat: 28.6550, lng: 77.4700, type: 'BreathingProblem', severity: 'High',     support: 'Oxygen+ALS', status: 'Pending' },
    { id: 'E005', name: 'Rohan', lat: 28.6800, lng: 77.4550, type: 'Fever',            severity: 'Low',      support: 'BLS', status: 'Completed' },
];

/* NCR / Delhi-NCR city locations for the emergency form */
const CITY_LOCATIONS = [
    { name: 'New Delhi',        lat: 28.6139, lng: 77.2090 },
    { name: 'Delhi',            lat: 28.6519, lng: 77.2315 },
    { name: 'Noida',            lat: 28.5355, lng: 77.3910 },
    { name: 'Greater Noida',    lat: 28.4744, lng: 77.5040 },
    { name: 'Ghaziabad',        lat: 28.6692, lng: 77.4538 },
    { name: 'Gurugram (Gurgaon)', lat: 28.4595, lng: 77.0266 },
    { name: 'Faridabad',        lat: 28.4089, lng: 77.3178 },
    { name: 'Meerut',           lat: 28.9845, lng: 77.7064 },
    { name: 'Sonipat',          lat: 28.9931, lng: 77.0151 },
    { name: 'Panipat',          lat: 29.3909, lng: 76.9635 },
    { name: 'Rohtak',           lat: 28.8955, lng: 76.6066 },
    { name: 'Bahadurgarh',      lat: 28.6924, lng: 76.9356 },
    { name: 'Hapur',            lat: 28.7306, lng: 77.7756 },
    { name: 'Bulandshahr',      lat: 28.4042, lng: 77.8578 },
    { name: 'Aligarh',          lat: 27.8974, lng: 78.0880 },
    { name: 'Jewar',            lat: 28.1493, lng: 77.5886 },
    { name: 'Manesar',          lat: 28.3538, lng: 76.9407 },
    { name: 'Palwal',           lat: 28.1448, lng: 77.3259 },
    { name: 'Rewari',           lat: 28.1980, lng: 76.6186 },
    { name: 'Karnal',           lat: 29.6857, lng: 76.9905 },
];

/* =========================================================
   BLOOD BANK — relational schema:
   BLOOD_BANKS  (blood_bank_id, name, city, lat, lng, contact, status)
   BLOOD_STOCK  (stock_id, blood_bank_id, blood_group, units_available, last_updated, expiry_date)
   ========================================================= */
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const BLOOD_BANKS = [
    { blood_bank_id: 'BB001', name: 'Indian Red Cross Blood Bank',  city: 'New Delhi',     lat: 28.6246, lng: 77.1997, contact: '+91 11 2371 6451', status: 'Active' },
    { blood_bank_id: 'BB002', name: 'AIIMS Blood Bank',             city: 'New Delhi',     lat: 28.5672, lng: 77.2100, contact: '+91 11 2658 8577', status: 'Active' },
    { blood_bank_id: 'BB003', name: 'Rotary Blood Bank',            city: 'New Delhi',     lat: 28.6200, lng: 77.2100, contact: '+91 11 2335 8328', status: 'Active' },
    { blood_bank_id: 'BB004', name: 'LifeLine Blood Bank',          city: 'Noida',         lat: 28.5730, lng: 77.3250, contact: '+91 120 244 0987', status: 'Active' },
    { blood_bank_id: 'BB005', name: 'Jaypee Blood Bank',            city: 'Noida',         lat: 28.6030, lng: 77.3500, contact: '+91 120 247 0110', status: 'Active' },
    { blood_bank_id: 'BB006', name: 'Yatharth Blood Bank',          city: 'Greater Noida', lat: 28.4780, lng: 77.4950, contact: '+91 120 616 4000', status: 'Maintenance' },
    { blood_bank_id: 'BB007', name: 'Sharda Blood Bank',            city: 'Greater Noida', lat: 28.4660, lng: 77.5060, contact: '+91 120 232 3412', status: 'Active' },
    { blood_bank_id: 'BB008', name: 'Yashoda Blood Bank',           city: 'Ghaziabad',     lat: 28.6730, lng: 77.4380, contact: '+91 120 455 5455', status: 'Active' },
    { blood_bank_id: 'BB009', name: 'MGM Blood Bank',               city: 'Ghaziabad',     lat: 28.6600, lng: 77.4450, contact: '+91 120 276 2211', status: 'Active' },
    { blood_bank_id: 'BB010', name: 'Medanta Blood Bank',           city: 'Gurugram',      lat: 28.4488, lng: 77.0738, contact: '+91 124 485 5588', status: 'Active' },
    { blood_bank_id: 'BB011', name: 'Artemis Blood Bank',           city: 'Gurugram',      lat: 28.4760, lng: 77.0980, contact: '+91 124 676 7700', status: 'Closed' },
    { blood_bank_id: 'BB012', name: 'Fortis Escorts Blood Bank',    city: 'Faridabad',     lat: 28.4050, lng: 77.3020, contact: '+91 129 419 2288', status: 'Active' },
    { blood_bank_id: 'BB013', name: 'Amrita Blood Bank',            city: 'Faridabad',     lat: 28.4210, lng: 77.2840, contact: '+91 129 419 0000', status: 'Active' },
];

const BLOOD_STOCK = (() => {
    const rows = [];
    let si = 1;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    BLOOD_BANKS.forEach((b, bi) => {
        BLOOD_GROUPS.forEach((g, gi) => {
            const base = g.endsWith('-') ? 4 : 9;
            const units = Math.max(0, base + ((bi * 5 + gi * 3) % 9) - ((gi % 3) === 0 ? 2 : 0));
            const exp = new Date(now.getTime() + (21 + (gi % 3) * 7) * 86400000).toISOString().slice(0, 10);
            rows.push({
                stock_id: 'S' + String(si++).padStart(4, '0'),
                blood_bank_id: b.blood_bank_id,
                blood_group: g,
                units_available: units,
                last_updated: today,
                expiry_date: exp,
            });
        });
    });
    return rows;
})();

const DEFAULT_DONORS = [
    { id: 'D001', name: 'Aarav Sharma',  age: 26, group: 'O+',  city: 'New Delhi',     phone: '+91 98111 22334', donated: '3 weeks ago' },
    { id: 'D002', name: 'Sneha Verma',   age: 24, group: 'A+',  city: 'Noida',         phone: '+91 98222 33445', donated: '1 week ago' },
    { id: 'D003', name: 'Kabir Singh',   age: 31, group: 'B-',  city: 'Gurugram',      phone: '+91 98333 44556', donated: '2 days ago' },
    { id: 'D004', name: 'Meera Joshi',   age: 28, group: 'AB+', city: 'Ghaziabad',     phone: '+91 98444 55667', donated: 'yesterday' },
    { id: 'D005', name: 'Rohan Gupta',   age: 35, group: 'O-',  city: 'Faridabad',     phone: '+91 98555 66778', donated: '5 days ago' },
    { id: 'D006', name: 'Ananya Iyer',   age: 22, group: 'A-',  city: 'Greater Noida', phone: '+91 98666 77889', donated: '1 month ago' },
    { id: 'D007', name: 'Dev Malhotra',  age: 40, group: 'B+',  city: 'New Delhi',     phone: '+91 98777 88990', donated: '2 weeks ago' },
    { id: 'D008', name: 'Ishita Rao',    age: 27, group: 'O+',  city: 'Noida',         phone: '+91 98888 99001', donated: '6 days ago' },
];
