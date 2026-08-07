/* =========================================================
   NovaBank — Banking Management System - DATA LAYER
   Generates a realistic random bank database (customers,
   accounts, transactions, loans, cards) stored in
   localStorage. All data below is randomly generated.
   ========================================================= */

const STORAGE_KEY = 'novabank_db_v2';

const BANK_INFO = {
    name: 'NovaBank',
    ifscPrefix: 'NOVA',
    helpline: '1800-NOVA-BANK',
    netbankingHelp: '1800-887-6540',
    email: 'care@novabank.in',
    branch: 'Main Branch, MG Road, Indore, MP - 452001',
    upiSuffix: '@novabank',
    minBalance: 2000
};

/* ---------- Seeded PRNG so demo data is stable ---------- */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(20260807);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randAmount(min, max) { return Math.round(rand() * (max - min) + min); }
function pad(n, w) { return String(n).padStart(w, '0'); }
let __uidc = 0;
function uid(prefix) {
    __uidc = (__uidc + 1) % 99991;
    return (prefix || 'id') + '_' + Date.now().toString(36) + __uidc.toString(36);
}

/* ---------- Fake data pools ---------- */
const FIRST_NAMES = ['Aarav','Vihaan','Diya','Ananya','Arjun','Saanvi','Rohan','Priya','Kabir','Ishita','Advait','Myra','Ranbir','Naina','Dev','Tara','Manav','Zoya','Ravi','Kavya','Aryan','Sneha','Vikram','Pooja','Harsh','Ritu','Sameer','Anjali'];
const LAST_NAMES = ['Sharma','Verma','Patel','Iyer','Nair','Singh','Gupta','Mehta','Joshi','Kulkarni','Das','Chawla','Kapoor','Malhotra','Bhatia','Saxena','Rao','Desai','Jain','Reddy'];
const CITIES = ['Indore','Bhopal','Mumbai','Delhi','Pune','Jaipur','Ahmedabad','Hyderabad','Nagpur','Bengaluru'];
const STREETS = ['MG Road','Ring Road','Vijay Nagar','Green Park','Civil Lines','Palace Road','Lake View','City Center','Sector 21','Grand Avenue'];
const DOMAINS = ['gmail.com','yahoo.com','outlook.com','novamail.in'];

const MERCHANTS = ['Swiggy','Amazon','BigBasket','Indian Oil Petrol','Electricity Board','Flipkart','Netflix','Zomato','Ola Cabs','Jio Recharge','Insurance Premium','Rent Payment','Groceries','Pharmacy','EMI Payment','Salary Credit','Airtel Recharge','BookMyShow','Myntra','Public Transport'];

const CHEQUE_BOOK_PAGES = [25, 50, 100];

/* ---------- Random generators ---------- */
function randomName() {
    return pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES) + (rand() > 0.5 ? ' ' + pick(['K.','R.','M.','S.','D.']) : '');
}
function randomEmail(name) {
    const core = name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).join('.');
    return core + '.' + randInt(10, 999) + '@' + pick(DOMAINS);
}
function randomPhone() {
    return '+91 ' + pick(['9','8','7','6']) + randInt(100000000, 999999999) + '';
}
function randomAddress() {
    return randInt(1, 400) + ', ' + pick(STREETS) + ', ' + pick(CITIES) + ' - ' + randInt(452001, 560100);
}
function randomCity() { return pick(CITIES); }
function randomDOB() {
    const y = randInt(1975, 2005);
    return y + '-' + pad(randInt(1, 12), 2) + '-' + pad(randInt(1, 28), 2);
}
function randomPAN() {
    let s = '';
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let i = 0; i < 5; i++) s += letters[randInt(0, letters.length - 1)];
    s += randInt(1000, 9999) + letters[randInt(0, letters.length - 1)];
    return s;
}

function randomCustomer(i) {
    const name = randomName();
    const city = randomCity();
    return {
        id: 'CUS' + pad(1000 + i, 4),
        name,
        email: randomEmailFrom(name),
        phone: randomPhone(),
        address: randomAddress(),
        city,
        dob: randomDOB(),
        pan: randomPAN(),
        kyc: rand() > 0.85 ? 'Pending' : 'Verified',
        createdAt: daysAgoStr(randInt(20, 700))
    };
}
function randomEmailFrom(name) {
    const core = name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).join('.');
    return core + '.' + randInt(10, 999) + '@' + pick(DOMAINS);
}

function accountNumber() {
    let n = String(randInt(10000000000, 99999999999));
    return n;
}
function ifsc() { return BANK_INFO.ifsc + '0' + pad(randInt(1, 99), 3); }

/* ---------- account ---------- */
function randomAccount(customerId, type, status) {
    type = type || pick(['Savings', 'Savings', 'Current', 'Fixed Deposit']);
    const bal = type === 'Current' ? randAmount(40000, 900000)
        : type === 'Fixed Deposit' ? randAmount(100000, 8000000)
        : randAmount(5000, 350000);
    return {
        id: uid('acc'),
        customerId,
        type,
        number: accountNumber(),
        ifsc: ifsc(),
        branch: 'NovaBank ' + randomCity() + ' Branch',
        balance: bal,
        rate: type === 'Savings' ? 3.5 : type === 'Current' ? 0 : 7.1,
        status: status || pick(['Active', 'Active', 'Active', 'Pending']),
        createdAt: daysAgoStr(randInt(20, 800))
    };
}

/* ---------- transactions ---------- */
function randomTxn(accountId, accountNo, daysBack) {
    const t = rand();
    let type, desc, amount, dir;
    if (t < 0.4) {
        type = 'Withdrawal'; desc = pick(MERCHANTS);
        amount = randAmount(100, 25000); dir = -1;
    } else if (t < 0.55) {
        type = 'UPI Pay'; desc = pick(MERCHANTS) + ' (UPI)';
        amount = randAmount(50, 8000); dir = -1;
    } else if (t < 0.7) {
        type = 'Transfer'; desc = 'Fund transfer to account ' + accountNumber().slice(0, 4) + 'XX';
        amount = randAmount(1000, 50000); dir = -1;
    } else if (t < 0.85) {
        type = 'Deposit'; desc = type === 'Deposit' ? 'Cash deposit' : 'Bank credit';
        amount = randAmount(500, 30000); dir = 1;
    } else {
        type = 'Interest'; desc = 'Monthly interest credit';
        amount = randAmount(10, 4000); dir = 1;
    }
    const d = new Date();
    d.setDate(d.getDate() - randInt(0, daysBack));
    return {
        id: uid('TX'),
        accountId,
        accountNo,
        type,
        description: desc,
        amount,
        dir,
        date: d.toISOString().slice(0, 10) + 'T' + pad(randInt(7, 21), 2) + ':' + pad(randInt(0, 59), 2) + ':00',
        status: 'Completed'
    };
}

/* ---------- loans ---------- */
const LOAN_TYPES = ['Home Loan', 'Personal Loan', 'Car Loan', 'Education Loan', 'Business Loan'];
function randomLoan(customerId, customerName, i) {
    const type = pick(LOAN_TYPES);
    const amount = randInt(2, 300) * 100000;
    const tenure = pick([12, 24, 36, 48, 60, 120, 180, 240]);
    const rate = +(rand() * 5 + 8.5).toFixed(1);
    const emi = computeEmi(amount, rate, tenure);
    const statusList = ['Approved', 'Approved', 'Pending', 'Rejected', 'Approved'];
    return {
        id: 'LN' + pad(100 + i, 3),
        customerId,
        customerName,
        type,
        amount,
        tenure,
        rate,
        emi: Math.round(emi),
        status: pick(statusList),
        appliedDate: daysAgoStr(randInt(2, 300)),
        purpose: pick(['Purchase of ' + type.toLowerCase().replace(' loan', ''), 'Home renovation', 'Business working capital', 'Car purchase', 'Higher education fees', 'Medical emergency', 'Debt consolidation'])
    };
}

/* EMI: P * r * (1+r)^n / ((1+r)^n - 1) */
function computeEmi(P, annualRate, months) {
    const r = annualRate / 12 / 100;
    if (r === 0) return P / months;
    return P * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

/* ---------- cards ---------- */
function randomCard(accountId, customerName, type) {
    type = type || (rand() > 0.6 ? 'Credit' : 'Debit');
    let num = '';
    for (let i = 0; i < 16; i++) num += randInt(0, 9);
    return {
        id: uid('CR'),
        accountId,
        customerName,
        type,
        variant: pick(['Classic', 'Gold', 'Platinum', 'Infinite']),
        number: num.match(/.{1,4}/g).join(' '),
        cvv: pad(randInt(100, 999), 3),
        expiry: pad(randInt(1, 12), 2) + '/' + (randInt(27, 30)),
        pin: pad(randInt(1000, 9999), 4),
        status: 'Active'
    };
}

/* ---------- date helpers ---------- */
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}
function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(ts) {
    if (!ts) return '';
    return formatDate(ts) + ' ' + formatTime(ts);
}
function formatINR(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
/* stable balance curve for a seeded account */
function runningBalance(acct) {
    return acct.balance;
}

/* ---------- Build random sample DB ---------- */
function generateSampleDB() {
    const db = { users: [], customers: [], accounts: [], transactions: [], loans: [], cards: [], notifications: [], activityLogs: [], chequeRequests: [], sessions: [] };

    /* Demo users + their customer profiles */
    const adminName = 'Admin Nova', userName = 'Priya Sharma';

    db.users.push({
        id: 'USR_ADMIN', name: adminName, email: 'admin@novabank.in', phone: '+91 98200 00001',
        passwordHash: hashPw('Admin@123'), role: 'Admin', twoFA: false, status: 'Active', createdAt: daysAgoStr(400)
    });
    db.users.push({
        id: 'USR_USER', name: userName, email: 'user@novabank.in', phone: '+91 98200 00002',
        passwordHash: hashPw('User@123'), role: 'User', twoFA: false, status: 'active', createdAt: daysAgoStr(300)
    });

    /* customer rows for the two demo users */
    db.customers.push({
        id: 'CUS0001', name: userName, email: 'user@novabank.in', phone: '+91 98200 00002',
        address: '21, Palace Road, Indore - 452001', city: 'Indore', dob: '1996-04-14', pan: 'AJKPP8251L',
        kyc: 'Verified', createdAt: daysAgoStr(300)
    });
    db.customers.push({
        id: 'CUS0002', name: adminName, email: 'admin@novabank.in', phone: '+91 98200 00001',
        address: '8, MG Road, Indore - 452002', city: 'Indore', dob: '1990-01-01', pan: 'BHIJ2230M',
        kyc: 'Verified', createdAt: daysAgoStr(400)
    });

    /* two accounts + history for demo user */
    const acc1 = randomAccount('CUS0001', 'Savings', 'Active');
    acc1.balance = 485000;
    const acc2 = randomAccount('CUS0001', 'Fixed Deposit', 'Active');
    acc2.balance = 1500000;
    const acc3 = randomAccount('CUS0001', 'Current', 'Pending'); // in pending queue for admin approve demo
    db.accounts.push(acc1, acc2, acc3);

    db.cards.push(randomCard(acc1.id, userName, 'Debit'));
    db.cards[0].number = '5519 3301 8840 2214';

    db.loans.push(randomLoan('CUS0001', userName, 1));
    db.loans[0].status = 'Pending';
    db.loans[0].type = 'Home Loan';

    /* random customers + their data */
    for (let i = 0; i < 12; i++) {
        const c = randomCustomer(10 + i);
        db.customers.push(c);
        const nAcc = randInt(1, 3);
        for (let a = 0; a < nAcc; a++) {
            const acct = randomAccount(c.id);
            db.accounts.push(acct);
            db.cards.push(randomCard(acct.id, c.name));
        }
        if (rand() > 0.35) db.loans.push(randomLoan(c.id, c.name, 10 + i));
    }

    /* transactions for every account (last 90 days) */
    db.accounts.forEach(acct => {
        const n = randInt(14, 40);
        const list = [];
        for (let i = 0; i < n; i++) list.push(randomTxn(acct.id, acct.number, 90));
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        db.transactions = db.transactions.concat(list);
    });
    db.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    /* activity logs + notifications for demo user */
    db.activityLogs.push(
        { id: uid('LOG'), userId: 'USR_USER', action: 'Account opened — Savings', date: daysAgoStr(60) },
        { id: uid('LOG'), userId: 'USR_USER', action: 'FD created — ₹1,500,000', date: daysAgoStr(40) },
        { id: uid('LOG'), userId: 'USR_ADMIN', action: 'Approved loan application LD-101', date: daysAgoStr(10) },
        { id: uid('LOG'), userId: 'USR_ADMIN', action: 'Updated interest rates', date: daysAgoStr(5) }
    );
    db.sessions.push(
        { id: uid('SS'), userId: 'USR_USER', device: 'Windows · Chrome', location: 'Indore', ip: '103.58.22.' + randInt(1, 250), lastSeen: 'Now' },
        { id: uid('SS'), userId: 'USR_USER', device: 'Android · NovaBank App', location: 'Bhopal', ip: '117.29.90.' + randInt(1, 250), lastSeen: daysAgoStr(2) },
        { id: uid('SS'), userId: 'USR_ADMIN', device: 'Windows · Chrome', location: 'Indore', ip: '103.58.22.9', lastSeen: daysAgoStr(0) }
    );
    db.notifications.push(
        { id: uid('NF'), userId: 'USR_USER', type: 'info', title: 'Welcome to NovaBank', msg: 'Your net banking account is active. Enable 2FA for extra security.', date: daysAgoStr(300) },
        { id: uid('NF'), userId: 'USR_USER', type: 'txn', title: 'Transaction Alert', msg: 'Interest credited on Savings — +₹3,214', date: daysAgoStr(3) }
    );
    return db;
}

/* ---------- simple password hash (demo only) ---------- */
function hashPw(pw) {
    let h = 0x811c9dc5;
    for (let i = 0; i < pw.length; i++) {
        h ^= pw.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return 'h' + (h >>> 0).toString(16) + '_' + pw.length.toString(16);
}
function verifyPw(pw, hash) {
    return hashPw(pw) === hash;
}

/* ---------- fake JWT ---------- */
function makeJWT(user) {
    const t = Date.now();
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
        sub: user.id, name: user.name, email: user.email, role: user.role,
        iat: t, exp: t + 3600 * 1000 * 2
    }));
    return header + '.' + payload + '.nv_' + hashPw(user.id + t).slice(0, 12);
}

/* ---------- INIT ---------- */
function initDB() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { db = null; }
    if (!db || !db.users || !db.customers) {
        db = generateSampleDB();
        saveDB(db);
    }
    return db;
}
function saveDB(db) {
    db = db || DB;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/* simple id counter helper */
let __seq = 1000;
function nextNum(prefix) {
    return (prefix || '') + (++__seq);
}