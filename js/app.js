/* =========================================================
   NovaBank — Banking Management System - APP LOGIC
   Auth (JWT/OTP/2FA), Accounts, Transactions, Loans, Cards,
   Services, Notifications, Admin Panel.
   ========================================================= */

/* ---------- Database ---------- */
let DB = initDB();
const SESSION_KEY = 'novabank_session';
let session = null;
let otpContext = null; // { purpose, email, payload, code, expiry }

/* ================= HELPERS ================= */
/* todayStr, formatINR, uid, saveDB are provided by data.js */

function nowTs() { return new Date().toISOString().slice(0, 10) + 'T' + new Date().toTimeString().slice(0, 8); }

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || 'info');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.className = 'toast', 3200);
}

function hashPwLocal(pw) {
    let h = 0x811c9dc5;
    for (let i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return 'h' + (h >>> 0).toString(16) + '_' + pw.length.toString(16);
}

/* ================= SESSION / JWT ================= */
function saveSession(user) {
    session = { token: makeJWT(user), userId: user.id, loginAt: Date.now(), remember: true };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function loadSession() {
    try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY));
        if (!s) return null;
        const user = DB.users.find(u => u.id === s.userId);
        if (!user) return null;
        const payload = JSON.parse(atob(s.token.split('.')[1]));
        if (payload.exp < Date.now()) { localStorage.removeItem(SESSION_KEY); return null; }
        return { ...s, user };
    } catch (e) { return null; }
}
function logout() {
    localStorage.removeItem(SESSION_KEY);
    session = null;
    location.reload();
}

/* ================= ACTIVITY LOG ================= */
function logActivity(action, userId) {
    DB.activityLogs.unshift({ id: uid('LOG'), userId: userId || (session && session.userId), action, date: nowTs() });
    if (DB.activityLogs.length > 60) DB.activityLogs.pop();
    saveDB();
}

/* ================= NOTIFICATIONS ================= */
function addNotification(userId, type, title, msg) {
    DB.notifications.unshift({ id: uid('NF'), userId, type, title, msg, date: nowTs(), read: false });
    saveDB();
    if (session && session.userId === userId) renderNotifBadge();
}
function myNotifications() {
    return DB.notifications.filter(n => n.userId === (session && session.userId)).slice(0, 20);
}

/* low balance alert */
function checkLowBalance(account) {
    if (account.balance < BANK_INFO.minBalance && account.status === 'Active') {
        addNotification(session.userId, 'low', 'Low Balance Alert',
            'Balance in account ' + maskAcc(account.number) + ' is below ₹' + BANK_INFO.minBalance.toLocaleString('en-IN') + '.');
    }
}
function maskAcc(num) {
    return String(num).slice(0, 4) + '••••' + String(num).slice(-4);
}

/* ================= NAVIGATION ================= */
const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'accounts', label: 'Accounts', icon: '🏦' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'transactions', label: 'Transactions', icon: '💸' },
    { id: 'loans', label: 'Loans', icon: '💰' },
    { id: 'cards', label: 'Cards', icon: '💳' },
    { id: 'services', label: 'Services', icon: '🧾' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'admin', label: 'Admin', icon: '🛡', adminOnly: true }
];

function renderNav() {
    const nav = document.getElementById('main-nav');
    const isAdmin = session && session.user.role === 'Admin';
    nav.innerHTML = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin)
        .map(i => `<a href="#" data-view="${i.id}" class="${i.id === 'admin' ? 'admin-link' : ''}">${i.icon} ${i.label}</a>`).join('');
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showView(a.dataset.view); }));
}

function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + id);
    if (!el) return;
    el.classList.add('active');
    document.querySelectorAll('#main-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === id));
    document.getElementById('view-' + id + '') && scrollToTop();
    const renderers = {
        dashboard: renderDashboard, accounts: renderAccounts, customers: renderCustomers,
        transactions: renderTransactions, loans: renderLoans, cards: renderCards,
        services: renderServices, profile: renderProfile, admin: renderAdmin
    };
    if (renderers[id]) renderers[id]();
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

/* ================= HEADER ================= */
function renderHeaderUser() {
    const box = document.getElementById('header-user');
    if (!session) {
        box.innerHTML = `<button class="btn btn-grad" id="btn-show-auth">Sign In</button>`;
        document.getElementById('btn-show-auth').addEventListener('click', showAuth);
        document.getElementById('topbar-session').innerHTML = '<span class="dot blue"></span> Guest mode — sign in to access banking';
        return;
    }
    const u = session.user;
    box.innerHTML = `
        <button class="btn btn-sm btn-ghost notif-btn" id="btn-notif" title="Notifications">🔔<span class="ncount" id="notif-count"></span></button>
        <div class="user-chip">
            <div class="avatar">${esc(u.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</div>
            <div><b>${esc(u.name)}</b><small>${u.role === 'Admin' ? 'Administrator' : 'Customer'}</small></div>
        </div>
        <button class="btn btn-sm btn-ghost" id="btn-logout">Logout</button>`;
    document.getElementById('btn-logout').addEventListener('click', () => { logActivity('User logged out'); logout(); });
    document.getElementById('btn-notif').addEventListener('click', e => { e.stopPropagation(); toggleNotifPanel(); });
    renderNotifBadge();
    document.getElementById('topbar-session').innerHTML =
        `<span class="dot"></span> Secure session · <b>${esc(u.email)}</b> · ${u.role === 'Admin' ? 'Admin Access' : 'Retail Banking'}`;
}

function renderNotifBadge() {
    const el = document.getElementById('notif-count');
    if (!session) return;
    const unread = DB.notifications.filter(n => n.userId === session.userId).length;
    el.textContent = unread ? unread : '';
    el.classList.toggle('show', !!unread);
}

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
    const notifs = myNotifications();
    panel.innerHTML = `<div class="card-flex"><h4>Notifications</h4><button class="btn btn-link" id="panel-clear">Clear</button></div>` +
        (notifs.length ? notifs.map(n => `
            <div class="notif-item">
                <span class="nicon">${n.type === 'low' ? '⚠️' : n.type === 'txn' ? '💸' : '🔔'}</span>
                <div class="ntext"><b>${formatDateTime(n.date)}</b>${esc(n.title)} — ${esc(n.msg)}</div>
            </div>`).join('')
            : '<div class="empty">No notifications.</div>');
    panel.classList.remove('hidden');
    document.getElementById('panel-clear').addEventListener('click', () => {
        DB.notifications = DB.notifications.filter(n => n.userId !== session.userId);
        saveDB();
        toggleNotifPanel(); renderNotifBadge();
        toast('Notifications cleared.', 'info');
    });
    setTimeout(() => {
        const closer = e => {
            if (e.target.closest && !e.target.closest('#notif-panel') && e.target.id !== 'btn-notif') {
                panel.classList.add('hidden');
                document.removeEventListener('click', closer);
            }
        };
        document.addEventListener('click', closer);
    }, 100);
}

/* ================= AUTH ================= */
function showAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-main').style.display = 'none';
    document.getElementById('footer-show') && (document.getElementById('footer-show').style.display = 'none');
    switchAuthCard('login');
    renderNav();
}
function hideAuth() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-main').style.display = '';
    switchAuthCard('login');
}

function switchAuthCard(which) {
    ['login', 'register', 'forgot'].forEach(k =>
        document.getElementById('auth-' + k).classList.toggle('hidden', k !== which));
}

function openOtpModal(purpose, verifyHandler) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpContext = { purpose, code, verifyHandler, expiry: Date.now() + 5 * 60 * 1000 };
    document.getElementById('otp-purpose').textContent = purpose;
    document.getElementById('demo-otp').textContent = code;
    document.getElementById('otp-input').value = '';
    document.getElementById('otp-modal').classList.remove('hidden');
    document.getElementById('otp-input').focus();
}

function bindAuth() {
    /* card switches */
    document.getElementById('link-register').addEventListener('click', e => { e.preventDefault(); switchAuthCard('register'); });
    document.getElementById('link-login').addEventListener('click', e => { e.preventDefault(); switchAuthCard('login'); });
    document.getElementById('link-login2').addEventListener('click', e => { e.preventDefault(); switchAuthCard('login'); });
    document.getElementById('link-forgot').addEventListener('click', e => { e.preventDefault(); switchAuthCard('forgot'); });

    /* password toggles */
    document.querySelectorAll('[data-pwd-toggle]').forEach(b =>
        b.addEventListener('click', () => {
            const inp = document.getElementById(b.dataset.pwdToggle);
            inp.type = inp.type === 'password' ? 'text' : 'password';
        }));

    /* login */
    document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const pw = document.getElementById('login-password').value;
        const user = DB.users.find(u => u.email.toLowerCase() === email);
        if (!user) return toast('No account found with this email.', 'error');
        if (user.status === 'Blocked') return toast('Account blocked. Contact support.', 'error');
        if (!verifyPw(pw, user.passwordHash)) return toast('Incorrect password.', 'error');

        if (user.twoFA) {
            openOtpModal('2-Factor Verification — enter the 6-digit OTP sent to ' + email, () => finalizeLogin(user));
        } else {
            finalizeLogin(user);
        }
    });

    /* register */
    document.getElementById('register-form').addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const phone = document.getElementById('reg-phone').value.trim();
        const pw = document.getElementById('reg-password').value;
        if (pw.length < 6) return toast('Password must be at least 6 characters.', 'error');
        if (DB.users.find(u => u.email.toLowerCase() === email)) return toast('Email already registered.', 'error');

        const pending = { name, email, phone, pw };
        openOtpModal('Registration OTP sent to ' + email, () => {
            const user = {
                id: uid('USR'), name, email, phone,
                passwordHash: hashPwLocal(pw), role: 'User', twoFA: false,
                status: 'Active', createdAt: todayStr()
            };
            DB.users.push(user);
            DB.customers.push({
                id: 'CUS' + Math.floor(10000 + Math.random() * 89999), name, email, phone,
                address: '—', city: '—', dob: '', pan: '—', kyc: 'Pending', createdAt: todayStr()
            });
            addNotification(user.id, 'info', 'Welcome to NovaBank', 'Account created. Please complete KYC in your profile.');
            saveDB();
            toast('Registration successful! Welcome to NovaBank.', 'success');
            switchAuthCard('login');
            document.getElementById('login-email').value = email;
        });
    });

    /* forgot password */
    document.getElementById('forgot-form').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim().toLowerCase();
        const user = DB.users.find(u => u.email.toLowerCase() === email);
        if (!user) return toast('No account found with this email.', 'error');
        openOtpModal('Password reset OTP sent to ' + email, () => {
            const npw = 'User@' + Math.floor(1000 + Math.random() * 8999);
            user.passwordHash = hashPwLocal(npw);
            saveDB();
            toast('Password reset. New password: ' + npw, 'success');
            switchAuthCard('login');
        });
    });

    /* otp modal */
    document.getElementById('otp-verify').addEventListener('click', verifyOtp);
    document.getElementById('otp-input').addEventListener('keydown', e => { if (e.key === 'Enter') verifyOtp(); });
    document.getElementById('otp-cancel').addEventListener('click', () => {
        document.getElementById('otp-modal').classList.add('hidden');
        otpContext = null;
    });
    document.getElementById('otp-resend').addEventListener('click', () => {
        if (!otpContext) return;
        const code = String(Math.floor(100000 + Math.random() * 900000));
        otpContext.code = code;
        document.getElementById('demo-otp').textContent = code;
        toast('New OTP sent (demo).', 'info');
    });
}

function verifyOtp() {
    if (!otpContext) return;
    const val = document.getElementById('otp-input').value.trim();
    if (val !== otpContext.code) return toast('Incorrect OTP. Please try again.', 'error');
    if (Date.now() > otpContext.expiry) return toast('OTP expired. Request a new one.', 'error');
    const fn = otpContext.verifyHandler;
    document.getElementById('otp-modal').classList.add('hidden');
    otpContext = null;
    fn();
}

function finalizeLogin(user) {
    saveSession(user);
    session = loadSession();
    logActivity('User logged in');
    addNotification(user.id, 'info', 'New Login', 'Signed in on ' + (navigator.platform || 'your device') + '.');
    hideAuth();
    renderHeaderUser();
    renderNav();
    showView('dashboard');
    toast('Welcome back, ' + user.name.split(' ')[0] + '! 👋', 'success');
}

/* ================= CUSTOMERS (helper lookups) ================= */
function getCustomerByUser(userId) {
    const email = session.user.email;
    return DB.customers.find(c => c.email === email) || DB.customers[0];
}
function accountsOfCustomer(custId) { return DB.accounts.filter(a => a.customerId === custId); }
function accountsOf(userEmail) {
    const cust = DB.customers.find(c => c.email === userEmail);
    return cust ? DB.accounts.filter(a => a.customerId === cust.id) : [];
}
function activeAccountsOf(userEmail) { return accountsOf(userEmail).filter(a => a.status === 'Active'); }

/* ================= DASHBOARD ================= */
function renderDashboard() {
    const u = session.user;
    document.getElementById('dash-user').textContent = u.name.split(' ')[0];
    const accs = activeAccountsOf(u.email);
    const total = accs.reduce((s, a) => s + a.balance, 0);
    document.getElementById('dash-total-balance').textContent = formatINR(total);
    document.getElementById('dash-acc-count').textContent = accs.length + ' active account(s)';

    document.getElementById('dash-acc').textContent = DB.accounts.filter(a => a.customerId && a.status !== 'Closed').length;
    document.getElementById('dash-loans').textContent = DB.loans.filter(l => l.customerName === u.name && l.status !== 'Rejected').length;
    document.getElementById('dash-cards').textContent = DB.cards.filter(c => c.customerName === u.name).length;
    const thisMonth = DB.transactions.filter(t => t.date.slice(0, 7) === todayStr().slice(0, 7)).length;
    document.getElementById('dash-txns').textContent = thisMonth;
    document.getElementById('dash-credit').textContent = Math.floor(680 + Math.random() * 60);

    /* mini accounts */
    document.getElementById('dash-acct-strip').innerHTML = accs.length
        ? accs.map(a => `
            <div class="acct-mini">
                <small>${esc(a.type)} · ${maskAcc(a.number)}</small>
                <b>${formatINR(a.balance)}</b>
                <small>${esc(a.branch.split(' ').slice(0, 2).join(' '))}</small>
            </div>`).join('')
        : '<div class="empty">No active accounts. Open one from the Accounts tab.</div>';

    /* recent transactions */
    const txns = DB.transactions.slice(0, 6);
    document.getElementById('dash-txn-list').innerHTML = txns.length
        ? txns.map(t => `
            <div class="list-item">
                <div class="li-main">
                    <b>${esc(t.description)}</b>
                    <div>${esc(t.type)} · ${formatDateTime(t.date)} · A/c ${maskAcc(t.accountNo)}</div>
                </div>
                <div class="txn-amt ${t.dir > 0 ? 'in' : 'out'}">${t.dir > 0 ? '+' : '−'}${formatINR(t.amount)}</div>
            </div>`).join('')
        : '<div class="empty">No transactions yet.</div>';

    /* notifications */
    const notifs = myNotifications();
    document.getElementById('dash-notif-list').innerHTML = notifs.length
        ? notifs.map(n => `
            <div class="notif-item">
                <span class="nicon">${n.type === 'low' ? '⚠️' : n.type === 'txn' ? '💸' : '🔔'}</span>
                <div class="ntext">${esc(n.title)} — ${esc(n.msg)}<b>${formatDateTime(n.date)}</b></div>
            </div>`).join('')
        : '<div class="empty">No notifications.</div>';

    /* quick actions */
    document.querySelectorAll('.qa').forEach(q => q.addEventListener('click', () => {
        showView('transactions');
        switchTxnTab(q.dataset.action);
    }));
}

/* ================= ACCOUNTS ================= */
function renderAccounts() {
    const cust = getCustomerByUser();
    const accs = cust ? DB.accounts.filter(a => a.customerId === cust.id) : [];
    const grid = document.getElementById('accounts-grid');

    if (!accs.length) {
        grid.innerHTML = '<div class="empty">No accounts yet. Click “Open New Account” to begin.</div>';
        return;
    }
    grid.innerHTML = accs.map(a => {
        const statusCls = a.status === 'Active' ? 'active' : a.status === 'Pending' ? 'pending' : 'closed';
        return `
        <div class="account-card">
            <div class="acct-head ${statusCls}">
                <div class="acct-type"><span>${esc(a.type)}</span><span class="badge ${a.status === 'Active' ? 'active' : a.status === 'Closed' ? 'blocked' : 'pending'}">${a.status}</span></div>
                <div class="acct-no">${a.number}</div>
                <div class="acct-balance">${formatINR(a.balance)}</div>
            </div>
            <div class="acct-meta">
                <div><b>IFSC:</b> ${esc(a.ifsc)}</div>
                <div><b>Branch:</b> ${esc(a.branch)}</div>
                <div><b>Opened:</b> ${formatDate(a.createdAt)} · <b>Rate:</b> ${a.rate}%</div>
            </div>
            <div class="acct-actions">
                <button class="btn btn-sm btn-ghost" data-acct-stmt="${a.id}">🧾 Statement</button>
                ${a.status === 'Active'
                    ? `<button class="btn btn-sm btn-danger" data-acct-close="${a.id}">Close Account</button>`
                    : `<button class="btn btn-sm btn-ghost" data-acct-retry="${a.id}">Re-submit</button>`}
            </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-acct-stmt]').forEach(b => b.addEventListener('click', () => printStatement(b.dataset.acctStmt)));
    grid.querySelectorAll('[data-acct-close]').forEach(b => b.addEventListener('click', () => closeAccount(b.dataset.acctClose)));
    grid.querySelectorAll('[data-acct-retry]').forEach(b => b.addEventListener('click', () => {
        const a = DB.accounts.find(x => x.id === b.dataset.acctRetry);
        if (a) { a.status = 'Pending'; saveDB(); toast('Account re-submitted for approval.', 'info'); renderAccounts(); }
    }));
}

function openAccountModal() {
    const cust = getCustomerByUser();
    const html = `
        <h3>Open New Account</h3>
        <form id="open-acct-form">
            <label>Account Type *</label>
            <select id="oa-type" class="input">
                <option value="Savings">Savings Account (3.5% p.a.)</option>
                <option value="Current">Current Account (0%)</option>
                <option value="Fixed Deposit">Fixed Deposit (7.1% p.a.)</option>
            </select>
            <label>Initial Deposit (₹) *</label>
            <input type="number" id="oa-deposit" class="input" min="1000" value="10000" required>
            <label>Branch</label>
            <select id="oa-branch" class="input">
                ${['Indore', 'Bhopal', 'Mumbai', 'Delhi', 'Pune', 'Jaipur'].map(c => `<option>${c}</option>`).join('')}
            </select>
            <div id="oa-fd-extra"></div>
            <label>Nominee Name</label>
            <input type="text" id="oa-nominee" class="input" placeholder="e.g. Family member">
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" id="oa-cancel">Cancel</button>
                <button type="submit" class="btn btn-grad">Submit for Approval →</button>
            </div>
        </form>`;
    openModal(html);
    document.getElementById('oa-type').addEventListener('change', e => {
        document.getElementById('oa-fd-extra').innerHTML = e.target.value === 'Fixed Deposit'
            ? `<label>FD Tenure (Months)</label><select id="oa-tenure" class="input">
                 <option>12</option><option>24</option><option>36</option><option>60</option><option>120</option></select>`
            : '';
    });
    document.getElementById('oa-cancel').addEventListener('click', closeModal);
    document.getElementById('open-acct-form').addEventListener('submit', e => {
        e.preventDefault();
        const type = document.getElementById('oa-type').value;
        const deposit = parseFloat(document.getElementById('oa-deposit').value);
        const branch = document.getElementById('oa-branch').value;
        if (!deposit || deposit < 1000) return toast('Minimum initial deposit is ₹1,000.', 'error');
        const acc = {
            id: uid('acc'), customerId: getCustomerByUser().id, type,
            number: String(Math.floor(10000000000 + Math.random() * 89999999999)),
            ifsc: BANK_INFO.ifsc + '0' + Math.floor(100 + Math.random() * 899),
            branch: 'NovaBank ' + branch + ' Branch',
            balance: type === 'Fixed Deposit' ? deposit : deposit,
            rate: type === 'Savings' ? 3.5 : type === 'Current' ? 0 : 7.1,
            status: 'Pending', createdAt: todayStr(), tenureMonths: type === 'Fixed Deposit' ? +(document.getElementById('oa-tenure')?.value || 24) : null
        };
        DB.accounts.push(acc);
        addNotification(session.userId, 'info', 'Account Application', type + ' account application ' + acc.number + ' submitted for approval.');
        logActivity('Opened ' + type + ' account ' + acc.number);
        saveDB();
        closeModal();
        toast(type + ' account submitted for admin approval.', 'success');
        renderAccounts();
    });
}

function closeAccount(id) {
    const a = DB.accounts.find(x => x.id === id);
    if (!a) return;
    if (!confirm('Close account ' + a.number + '? This will zero the balance.')) return;
    if (a.balance > 0) {
        DB.transactions.unshift({
            id: uid('TX'), accountId: a.id, accountNo: a.number, type: 'Transfer',
            description: 'Account closure — balance settled', amount: a.balance, dir: -1,
            date: nowTs(), status: 'Completed'
        });
    }
    a.balance = 0; a.status = 'Closed';
    addNotification(session.userId, 'info', 'Account Closed', 'Account ' + maskAcc(a.number) + ' has been closed.');
    logActivity('Closed account ' + a.number);
    saveDB();
    toast('Account closed.', 'success');
    renderAccounts();
}

/* ================= CUSTOMERS (admin) ================= */
function renderCustomers() {
    const q = (document.getElementById('customer-search').value || '').toLowerCase();
    const list = DB.customers.filter(c => {
        if (c.id === 'CUS_CUSTOM' || c.email === session.user.email) return false;
        return !q || [c.name, c.email, c.phone, c.city].join(' ').toLowerCase().includes(q);
    });
    const tbody = document.getElementById('customer-tbody');
    tbody.innerHTML = list.map(c => {
        const n = DB.accounts.filter(a => a.customerId === c.id).length;
        return `<tr>
            <td><code>${esc(c.id)}</code></td>
            <td><b>${esc(c.name)}</b></td>
            <td>${esc(c.phone)}</td>
            <td>${esc(c.email)}</td>
            <td>${esc(c.city)}</td>
            <td>${n}</td>
            <td>
                <button class="btn btn-sm btn-ghost" data-cus-view="${c.id}">View</button>
                <button class="btn btn-sm btn-primary" data-cus-edit="${c.id}">Edit</button>
                <button class="btn btn-sm btn-danger" data-cus-del="${c.id}">Delete</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="7"><div class="empty">No customers found.</div></td></tr>';

    tbody.querySelectorAll('[data-cus-view]').forEach(b => b.addEventListener('click', () => viewCustomer(b.dataset.cusView)));
    tbody.querySelectorAll('[data-cus-edit]').forEach(b => b.addEventListener('click', () => editCustomer(b.dataset.cusEdit)));
    tbody.querySelectorAll('[data-cus-del]').forEach(b => b.addEventListener('click', () => deleteCustomer(b.dataset.cusDel)));
}

function viewCustomer(id) {
    const c = DB.customers.find(x => x.id === id);
    if (!c) return;
    const accs = DB.accounts.filter(a => a.customerId === id);
    const loans = DB.loans.filter(l => l.customerId === id);
    const cards = DB.cards.filter(k => accs.some(a => a.id === k.accountId));
    openModal(`
        <h3>Customer Profile — ${esc(c.name)}</h3>
        <div class="kv-grid">
            <div class="kv"><small>Customer ID</small><b>${esc(c.id)}</b></div>
            <div class="kv"><small>Phone</small><b>${esc(c.phone)}</b></div>
            <div class="kv"><small>Email</small><b>${esc(c.email)}</b></div>
            <div class="kv"><small>City</small><b>${esc(c.city)}</b></div>
            <div class="kv"><small>PAN</small><b>${esc(c.pan)}</b></div>
            <div class="kv"><small>KYC</small><b>${c.kyc}</b></div>
        </div>
        <hr class="sep">
        <h4>Accounts (${accs.length})</h4>
        ${accs.map(a => `<div class="list-item"><div class="li-main"><b>${esc(a.type)} · ${a.number}</b><div>${esc(a.branch)}</div></div><b class="num">${formatINR(a.balance)}</b></div>`).join('') || '<div class="empty">No accounts</div>'}
        <hr class="sep">
        <h4>Loans (${loans.length})</h4>
        ${loans.map(l => `<div class="list-item"><div class="li-main"><b>${esc(l.type)}</b><div>₹${Number(l.amount).toLocaleString('en-IN')} · ${l.tenure} months</div></div><span class="badge ${l.status === 'Approved' ? 'active' : l.status === 'Rejected' ? 'rejected' : 'pending'}">${l.status}</span></div>`).join('') || '<div class="empty">No loans</div>'}
        <div class="modal-actions"><button class="btn btn-ghost" data-close-modal>Close</button></div>
    `);
}

function editCustomer(id) {
    const c = DB.customers.find(x => x.id === id);
    if (!c) return;
    openModal(`
        <h3>Update Customer</h3>
        <form id="cus-edit-form">
            <label>Full Name</label><input id="ce-name" class="input" value="${esc(c.name)}" required>
            <label>Phone</label><input id="ce-phone" class="input" value="${esc(c.phone)}" required>
            <label>Email</label><input id="ce-email" class="input" type="email" value="${esc(c.email)}" required>
            <label>City</label><input id="ce-city" class="input" value="${esc(c.city)}">
            <label>Address</label><input id="ce-address" class="input" value="${esc(c.address)}">
            <label>KYC Status</label>
            <select id="ce-kyc" class="input"><option ${c.kyc === 'Verified' ? 'selected' : ''}>Verified</option><option ${c.kyc === 'Pending' ? 'selected' : ''}>Pending</option></select>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
                <button type="submit" class="btn btn-grad">Save Changes</button>
            </div>
        </form>`);
    document.getElementById('cus-edit-form').addEventListener('submit', e => {
        e.preventDefault();
        Object.assign(c, {
            name: document.getElementById('ce-name').value.trim(),
            phone: document.getElementById('ce-phone').value.trim(),
            email: document.getElementById('ce-email').value.trim(),
            city: document.getElementById('ce-city').value.trim(),
            address: document.getElementById('ce-address').value.trim(),
            kyc: document.getElementById('ce-kyc').value
        });
        saveDB(); closeModal();
        toast('Customer updated.', 'success');
        renderCustomers();
    });
}

function deleteCustomer(id) {
    const c = DB.customers.find(x => x.id === id);
    if (!c || !confirm('Delete customer ' + c.name + ' and all related data?')) return;
    DB.customers = DB.customers.filter(x => x.id !== id);
    const accIds = DB.accounts.filter(a => a.customerId === id).map(a => a.id);
    DB.accounts = DB.accounts.filter(a => a.customerId !== id);
    DB.cards = DB.cards.filter(k => !accIds.includes(k.accountId));
    DB.loans = DB.loans.filter(l => l.customerId !== id);
    DB.transactions = DB.transactions.filter(t => !accIds.includes(t.accountId));
    logActivity('Deleted customer ' + c.name);
    saveDB(); toast('Customer deleted.', 'success');
    renderCustomers();
}

function addCustomerModal() {
    openModal(`
        <h3>Add New Customer</h3>
        <form id="cus-add-form">
            <label>Full Name *</label><input id="ca-name" class="input" required>
            <label>Phone *</label><input id="ca-phone" class="input" required>
            <label>Email *</label><input id="ca-email" class="input" type="email" required>
            <label>City *</label><input id="ca-city" class="input" required>
            <label>Address</label><input id="ca-address" class="input">
            <label>PAN</label><input id="ca-pan" class="input">
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
                <button type="submit" class="btn btn-grad">Add Customer</button>
            </div>
        </form>`);
    document.getElementById('cus-add-form').addEventListener('submit', e => {
        e.preventDefault();
        const c = {
            id: 'CUS' + Math.floor(10000 + Math.random() * 89999),
            name: document.getElementById('ca-name').value.trim(),
            phone: document.getElementById('ca-phone').value.trim(),
            email: document.getElementById('ca-email').value.trim(),
            city: document.getElementById('ca-city').value.trim(),
            address: document.getElementById('ca-address').value.trim() || '—',
            pan: document.getElementById('ca-pan').value.trim() || '—',
            dob: '', kyc: 'Pending', createdAt: todayStr()
        };
        DB.customers.push(c);
        logActivity('Added customer ' + c.name);
        saveDB(); closeModal();
        toast('Customer added. KYC pending.', 'success');
        renderCustomers();
    });
}

/* ================= TRANSACTIONS ================= */
function switchTxnTab(name) {
    const map = { deposit: 'deposit', withdraw: 'withdraw', transfer: 'transfer', upi: 'upi' };
    const key = map[name] || name;
    document.querySelectorAll('#txn-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === key));
    ['deposit', 'withdraw', 'transfer', 'upi'].forEach(k =>
        document.getElementById('txn-panel-' + k).classList.toggle('hidden', k !== key));
    if (key === 'withdraw') document.getElementById('wit-account') && fillAccountSelects();
}

function fillAccountSelects() {
    const accs = activeAccountsOf(session.user.email);
    const opts = accs.map(a => `<option value="${a.id}">${esc(a.type)} · ${a.number} (${formatINR(a.balance)})</option>`).join('');
    ['dep-account', 'wit-account', 'tr-account', 'upi-account', 'bal-account', 'pass-account', 'cheque-account', 'stmt-account'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = opts || '<option value="">No active accounts</option>'; }
    });
    const cardAcct = document.getElementById('card-account');
    if (cardAcct) cardAcct.innerHTML = opts;
}

function renderTransactions() {
    fillAccountSelects();
    applyTxnFilters();
}

function applyTxnFilters() {
    const q = (document.getElementById('txn-search').value || '').toLowerCase();
    const type = document.getElementById('txn-filter').value;
    const mine = DB.accounts.filter(a => getCustomerByUser() && a.customerId === getCustomerByUser().id).map(a => a.id);
    const list = DB.transactions.filter(t => mine.includes(t.accountId))
        .filter(t => !type || t.type === type)
        .filter(t => !q || (t.description + t.type).toLowerCase().includes(q));

    /* accurate running balance for each transaction */
    const balMap = {};
    DB.accounts.forEach(a => {
        const txns = DB.transactions.filter(t => t.accountId === a.id)
            .sort((x, y) => new Date(x.date) - new Date(y.date));
        let bal = a.balance;
        for (let i = txns.length - 1; i >= 0; i--) { bal -= txns[i].dir * txns[i].amount; balMap[txns[i].id] = bal; }
    });

    document.getElementById('txn-tbody').innerHTML = list.slice(0, 60).map(t => `
        <tr>
            <td>${formatDate(t.date)}<br><small class="muted">${formatTime(t.date)}</small></td>
            <td><code>${t.accountNo}</code></td>
            <td><span class="badge ${t.type.toLowerCase().replace(/\s/g, '')}">${esc(t.type)}</span></td>
            <td>${esc(t.description)}</td>
            <td class="num ${t.dir > 0 ? '' : 'bad'}">${t.dir > 0 ? '+' : '−'}${formatINR(t.amount)}</td>
            <td class="num">${formatINR(balMap[t.id] ?? t.amount)}</td>
        </tr>`).join('') || '<tr><td colspan="6"><div class="empty">No transactions found.</div></td></tr>';
}

function doTxn(accountId, type, amount, desc, dir) {
    const a = DB.accounts.find(x => x.id === accountId);
    if (!a) return toast('Account not found.', 'error');
    if (a.status !== 'Active') return toast('Account is not active.', 'error');
    if (!amount || amount <= 0) return toast('Enter a valid amount.', 'error');
    if (dir < 0 && a.balance - amount < 0) return toast('Insufficient balance.', 'error');
    if (dir < 0 && type !== 'Transfer' && type !== 'UPI Pay' && a.balance - amount < BANK_INFO.minBalance)
        toast('Note: balance will drop below minimum.', 'info');

    a.balance += dir * amount;
    DB.transactions.unshift({
        id: uid('TX'), accountId: a.id, accountNo: a.number, type, description: desc,
        amount, dir, date: nowTs(), status: 'Completed'
    });
    if (a.balance < BANK_INFO.minBalance) checkLowBalance(a);
    addNotification(session.userId, 'txn', type + ' Alert',
        (dir > 0 ? '+' : '−') + formatINR(amount) + ' · ' + maskAcc(a.number) + ' · ' + desc);
    logActivity(type + ' of ' + formatINR(amount) + ' on ' + maskAcc(a.number));
    saveDB();
    return true;
}

function bindTransactions() {
    document.getElementById('txn-tabs').querySelectorAll('.tab').forEach(t =>
        t.addEventListener('click', () => switchTxnTab(t.dataset.tab)));
    document.getElementById('txn-search').addEventListener('input', applyTxnFilters);
    document.getElementById('txn-filter').addEventListener('change', applyTxnFilters);

    document.getElementById('deposit-form').addEventListener('submit', e => {
        e.preventDefault();
        const ok = doTxn(document.getElementById('dep-account').value, 'Deposit',
            parseFloat(document.getElementById('dep-amount').value),
            document.getElementById('dep-note').value || 'Cash deposit', 1);
        if (ok) { e.target.reset(); toast('Deposit successful.', 'success'); applyTxnFilters(); }
    });
    document.getElementById('withdraw-form').addEventListener('submit', e => {
        e.preventDefault();
        const ok = doTxn(document.getElementById('wit-account').value, 'Withdrawal',
            parseFloat(document.getElementById('wit-amount').value),
            'Withdrawal (' + document.getElementById('wit-mode').value + ')', -1);
        if (ok) { e.target.reset(); toast('Withdrawal successful.', 'success'); applyTxnFilters(); }
    });
    document.getElementById('transfer-form').addEventListener('submit', e => {
        e.preventDefault();
        const ben = document.getElementById('tr-beneficiary').value.trim();
        if (ben.length < 9) return toast('Enter a valid beneficiary account number.', 'error');
        const ok = doTxn(document.getElementById('tr-account').value, 'Transfer',
            parseFloat(document.getElementById('tr-amount').value),
            'Fund transfer to ' + maskAcc(ben) + (document.getElementById('tr-note').value ? ' · ' + document.getElementById('tr-note').value : ''), -1);
        if (ok) { e.target.reset(); toast('Funds transferred.', 'success'); applyTxnFilters(); }
    });
    document.getElementById('upi-form').addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('upi-id').value.trim();
        if (!id.includes('@')) return toast('Invalid UPI ID (e.g. name@novabank).', 'error');
        const ok = doTxn(document.getElementById('upi-account').value, 'UPI Pay',
            parseFloat(document.getElementById('upi-amount').value), 'UPI to ' + id, -1);
        if (ok) { e.target.reset(); toast('UPI payment successful.', 'success'); applyTxnFilters(); }
    });

    document.getElementById('btn-mini-statement').addEventListener('click', showMiniStatement);
}

function showMiniStatement() {
    const accs = activeAccountsOf(session.user.email);
    const html = `
        <label>Select Account</label>
        <select id="mini-acc" class="input">${accs.map(a => `<option value="${a.id}">${esc(a.type)} · ${a.number}</option>`).join('')}</select>
        <div id="mini-list" class="mt" style="margin-top:14px"></div>`;
    document.getElementById('mini-content').innerHTML = html || '<div class="empty">No accounts.</div>';
    document.getElementById('mini-modal').classList.remove('hidden');
    const render = () => {
        const id = document.getElementById('mini-acc').value || (accs[0] && accs[0].id);
        const a = DB.accounts.find(x => x.id === id);
        if (!a) {
            document.getElementById('mini-list').innerHTML = '<div class="empty">No active accounts available.</div>';
            return;
        }
        const txns = DB.transactions.filter(t => t.accountId === id).slice(0, 8);
        document.getElementById('mini-list').innerHTML = `
            <div class="kv-grid" style="margin-bottom:10px">
                <div class="kv"><small>Account</small><b>${a.number}</b></div>
                <div class="kv"><small>Balance</small><b>${formatINR(a.balance)}</b></div>
            </div>
            ${txns.map(t => `<div class="list-item"><div class="li-main"><b>${esc(t.description)}</b><div>${esc(t.type)} · ${formatDateTime(t.date)}</div></div><div class="txn-amt ${t.dir > 0 ? 'in' : 'out'}">${t.dir > 0 ? '+' : '−'}${formatINR(t.amount)}</div></div>`).join('')}`;
    };
    document.getElementById('mini-acc').addEventListener('change', render);
    render();
    document.getElementById('mini-close').addEventListener('click', () =>
        document.getElementById('mini-modal').classList.add('hidden'));
}

/* ================= LOANS ================= */
function renderLoans() {
    const mine = DB.loans.filter(l => l.customerName === session.user.name);
    document.getElementById('loan-tbody').innerHTML = mine.map(l => `
        <tr>
            <td><code>${esc(l.id)}</code></td>
            <td>${esc(l.type)}</td>
            <td class="num">${formatINR(l.amount)}</td>
            <td>${l.tenure} mo</td>
            <td class="num">${formatINR(l.emi)}</td>
            <td>${l.rate}%</td>
            <td><span class="badge ${l.status === 'Approved' ? 'active' : l.status === 'Rejected' ? 'rejected' : 'pending'}">${l.status}</span></td>
            <td>${formatDate(l.appliedDate)}</td>
        </tr>`).join('') || '<tr><td colspan="8"><div class="empty">No loan applications yet.</div></td></tr>';
}

function bindLoans() {
    document.getElementById('loan-form').addEventListener('submit', e => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('loan-amount').value);
        const tenure = parseInt(document.getElementById('loan-tenure').value, 10);
        if (!amount || !tenure) return toast('Enter amount and tenure.', 'error');
        const type = document.getElementById('loan-type').value;
        const rate = +(type === 'Home Loan' ? 8.5 : type === 'Car Loan' ? 9.3 : type === 'Education Loan' ? 8.2 : type === 'Business Loan' ? 12.5 : 11).toFixed(1);
        const loan = {
            id: 'LN' + Math.floor(100 + Math.random() * 899),
            customerId: getCustomerByUser().id, customerName: session.user.name,
            type, amount, tenure, rate,
            emi: Math.round(computeEmi(amount, rate, tenure)),
            status: 'Pending', appliedDate: todayStr(),
            purpose: document.getElementById('loan-purpose').value || 'General purpose'
        };
        DB.loans.unshift(loan);
        addNotification(session.userId, 'info', 'Loan Application', type + ' of ' + formatINR(amount) + ' submitted for review.');
        logActivity('Applied for ' + type + ' of ' + formatINR(amount));
        saveDB(); e.target.reset();
        toast('Loan application submitted. Status: Pending', 'success');
        renderLoans();
    });

    document.getElementById('btn-calc-emi').addEventListener('click', () => {
        const P = parseFloat(document.getElementById('emi-p').value);
        const R = parseFloat(document.getElementById('emi-r').value);
        const N = parseInt(document.getElementById('emi-n').value, 10);
        if (!P || !R || !N) return toast('Fill principal, rate and tenure.', 'error');
        const emi = computeEmi(P, R, N);
        const total = emi * N;
        document.getElementById('emi-result').innerHTML = `
            <div class="er-label">Monthly EMI</div>
            <div class="er-big">${formatINR(emi)}</div>
            <div class="er-label" style="margin-top:10px">Total Payable · Interest</div>
            <div class="er-big" style="font-size:1.1rem">${formatINR(total)} · ${formatINR(total - P)}</div>`;
    });
}

/* ================= CARDS ================= */
function renderCards() {
    const mine = DB.cards.filter(c => c.customerName === session.user.name);
    document.getElementById('cards-list').innerHTML = mine.map(c => `
        <div class="bank-card ${c.type === 'Credit' ? 'credit' : 'debit'}">
            <div class="cc-top">
                <div>
                    <div style="font-size:.7rem;letter-spacing:2px;opacity:.85">NovaBank</div>
                    <div style="font-weight:800">${c.type} Card</div>
                </div>
                <div class="chip"></div>
            </div>
            <div class="cc-number">${c.number}</div>
            <div class="cc-bottom">
                <div><span>Card Holder</span><br><b class="holder2">${esc(c.customerName)}</b></div>
                <div><span>Expires</span><br><b>${c.expiry}</b></div>
                <div><span>CVV</span><br><b>•••</b></div>
            </div>
            <span class="badge ${c.status === 'Active' ? 'active' : 'blocked'} card-tag">${c.status}</span>
            <div style="margin-top:14px;position:relative;z-index:2;display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-sm btn-ghost" data-card-pin="${c.id}">🔑 Show PIN</button>
                <button class="btn btn-sm btn-danger" data-card-block="${c.id}">🚫 Block Card</button>
            </div>
        </div>`).join('') || '<div class="empty">No cards yet. Request one on the left.</div>';

    document.querySelectorAll('[data-card-pin]').forEach(b => b.addEventListener('click', () => {
        const c = DB.cards.find(x => x.id === b.dataset.cardPin);
        toast('Card PIN: ' + c.pin + ' (demo)', 'info');
    }));
    document.querySelectorAll('[data-card-block]').forEach(b => b.addEventListener('click', () => {
        const c = DB.cards.find(x => x.id === b.dataset.cardBlock);
        if (c.status === 'Blocked') return toast('Card already blocked.', 'info');
        if (!confirm('Block card ending ' + c.number.slice(-4) + '?')) return;
        c.status = 'Blocked';
        addNotification(session.userId, 'low', 'Card Blocked', 'Card ending ' + c.number.slice(-4) + ' has been blocked.');
        logActivity('Blocked card ending ' + c.number.slice(-4));
        saveDB(); renderCards();
        toast('Card blocked successfully.', 'success');
    }));
}

function bindCards() {
    document.getElementById('card-form').addEventListener('submit', e => {
        e.preventDefault();
        const type = document.getElementById('card-type').value;
        const variant = document.getElementById('card-variant').value;
        const accountId = document.getElementById('card-account').value;
        if (type === 'Debit Card' && !accountId) return toast('Select an account to link the debit card.', 'error');
        const num = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
        const card = {
            id: uid('CR'), accountId, customerName: session.user.name, type,
            variant, number: num.match(/.{1,4}/g).join(' '),
            cvv: String(Math.floor(100 + Math.random() * 900)),
            expiry: String(new Date().getMonth() + 1).padStart(2, '0') + '/' + (new Date().getFullYear() + 5 - 2000),
            pin: String(Math.floor(1000 + Math.random() * 9000)), status: 'Active'
        };
        DB.cards.unshift(card);
        addNotification(session.userId, 'info', 'Card Issued', variant + ' ' + type + ' ending ' + card.number.slice(-4) + ' is ready.');
        logActivity('Requested ' + type + ' (' + variant + ')');
        saveDB(); e.target.reset();
        toast(variant + ' ' + type + ' issued.', 'success');
        renderCards();
    });
}

/* ================= SERVICES ================= */
function renderServices() { fillAccountSelects(); }

function bindServices() {
    document.getElementById('btn-balance').addEventListener('click', () => {
        const id = document.getElementById('bal-account').value;
        const a = DB.accounts.find(x => x.id === id);
        if (!a) return toast('Select an account.', 'error');
        document.getElementById('bal-output').innerHTML =
            `Available Balance <b>${formatINR(a.balance)}</b><br><span class="muted">${esc(a.type)} · ${a.number} · ${esc(a.ifsc)}</span>`;
    });
    document.getElementById('btn-passbook').addEventListener('click', () => {
        const id = document.getElementById('pass-account').value;
        const a = DB.accounts.find(x => x.id === id);
        if (!a) return toast('Select an account.', 'error');
        const txns = DB.transactions.filter(t => t.accountId === id).slice(0, 15);
        openModal(`
            <h3>Passbook — ${esc(a.type)}</h3>
            <p class="muted">A/c ${a.number} · Balance <b>${formatINR(a.balance)}</b></p>
            ${txns.map(t => `<div class="list-item"><div class="li-main"><b>${esc(t.description)}</b><div>${formatDateTime(t.date)}</div></div><div class="txn-amt ${t.dir > 0 ? 'in' : 'out'}">${t.dir > 0 ? '+' : '−'}${formatINR(t.amount)}</div></div>`).join('')}
            <div class="modal-actions"><button class="btn btn-ghost" data-close-modal>Close</button></div>`);
    });
    document.getElementById('btn-cheque').addEventListener('click', () => {
        const id = document.getElementById('cheque-account').value;
        const a = DB.accounts.find(x => x.id === id);
        if (!a) return toast('Select an account.', 'error');
        DB.chequeRequests.push({ id: uid('CHQ'), accountId: a.id, accountNo: a.number, pages: pick(CHECKBOOK_PAGES || [25, 50, 100]), status: 'Requested', date: nowTs() });
        addNotification(session.userId, 'info', 'Cheque Book Requested', '25-leaf cheque book for ' + maskAcc(a.number) + '.');
        logActivity('Requested cheque book for ' + maskAcc(a.number));
        saveDB();
        toast('Cheque book requested. Delivery in 5 working days.', 'success');
    });
    document.getElementById('btn-interest').addEventListener('click', () => {
        const P = parseFloat(document.getElementById('int-p').value);
        const R = parseFloat(document.getElementById('int-r').value);
        const T = parseFloat(document.getElementById('int-t').value);
        if (!P || !R || !T) return toast('Fill all fields.', 'error');
        const type = document.getElementById('int-type').value;
        let out;
        if (type === 'Simple Interest') {
            const SI = P * R * T / 100;
            out = `Interest <b>${formatINR(SI)}</b><br><span class="muted">Maturity value: ${formatINR(P + SI)}</span>`;
        } else {
            const amount = P * Math.pow(1 + R / 100, T);
            out = `Maturity Value <b>${formatINR(amount)}</b><br><span class="muted">Interest earned: ${formatINR(amount - P)}</span>`;
        }
        document.getElementById('int-output').innerHTML = out;
    });
    document.getElementById('btn-statement').addEventListener('click', printStatement);
}

function printStatement(accountId) {
    const id = accountId || document.getElementById('stmt-account').value;
    const days = accountId ? 30 : parseInt(document.getElementById('stmt-period').value, 10);
    const a = DB.accounts.find(x => x.id === id);
    if (!a) return toast('Select an account.', 'error');
    const from = new Date();
    from.setDate(from.getDate() - days);
    const txns = DB.transactions.filter(t => t.accountId === id && new Date(t.date) >= from);
    const cust = getCustomerByUser();
    const area = document.getElementById('print-area');
    area.innerHTML = `
        <h1>NovaBank — Account Statement</h1>
        <div class="print-muted">Generated: ${new Date().toLocaleString('en-IN')} · Confidential</div>
        <hr>
        <p><b>Customer:</b> ${esc(cust ? cust.name : session.user.name)} &nbsp;|&nbsp; <b>Account:</b> ${a.number} &nbsp;|&nbsp; <b>IFSC:</b> ${esc(a.ifsc)}<br>
        <span class="print-muted">${esc(a.branch)} · Type: ${esc(a.type)} · Period: last ${days} days</span></p>
        <table>
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>
                ${txns.map(t => `<tr><td>${formatDateTime(t.date)}</td><td>${esc(t.type)}</td><td>${esc(t.description)}</td><td>${t.dir < 0 ? formatINR(t.amount) : ''}</td><td>${t.dir > 0 ? formatINR(t.amount) : ''}</td></tr>`).join('')}
            </tbody>
        </table>
        <p style="margin-top:14px"><b>Closing Balance: ${formatINR(a.balance)}</b></p>
        <p class="print-muted">This is a simulated statement for demonstration purposes only.</p>`;
    logActivity('Downloaded statement for ' + maskAcc(a.number));
    window.print();
}

/* ================= PROFILE ================= */
function renderProfile() {
    const u = session.user;
    const cust = getCustomerByUser();
    document.getElementById('pro-name').value = u.name;
    document.getElementById('pro-phone').value = u.phone;
    document.getElementById('pro-address').value = cust ? cust.address : '';

    document.getElementById('twofa-toggle').checked = !!u.twoFA;
    document.getElementById('alerts-toggle').checked = localStorage.getItem('nb_alerts') !== 'off';

    const logs = DB.activityLogs.filter(l => l.userId === u.id).slice(0, 15);
    document.getElementById('activity-tbody').innerHTML = logs.map(l =>
        `<tr><td>${formatDateTime(l.date)}</td><td>${esc(l.action)}</td></tr>`).join('')
        || '<tr><td colspan="2"><div class="empty">No activity yet.</div></td></tr>';

    const sessions = DB.sessions.filter(s => s.userId === u.id);
    document.getElementById('sessions-list').innerHTML = sessions.map(s => `
        <div class="list-item border-pink">
            <div class="li-main"><b>${esc(s.device)}</b><div>${esc(s.location)} · IP ${esc(s.ip)} · last seen ${esc(s.lastSeen)}</div></div>
            <span class="badge ${s.lastSeen === 'Now' ? 'active' : 'inactive'}">${s.lastSeen === 'Now' ? 'Current' : 'Other'}</span>
        </div>`).join('') || '<div class="empty">No sessions.</div>';

    document.getElementById('sec-2fa').textContent = u.twoFA ? 'Active' : 'Off';
}

function bindProfile() {
    document.getElementById('profile-form').addEventListener('submit', e => {
        e.preventDefault();
        const u = session.user;
        u.name = document.getElementById('pro-name').value.trim();
        u.phone = document.getElementById('pro-phone').value.trim();
        const cust = getCustomerByUser();
        if (cust) cust.address = document.getElementById('pro-address').value.trim();
        logActivity('Updated profile');
        saveDB(); saveSession(u);
        renderHeaderUser();
        toast('Profile updated.', 'success');
    });

    document.getElementById('pwd-form').addEventListener('submit', e => {
        e.preventDefault();
        const u = session.user;
        const oldPw = document.getElementById('pwd-old').value;
        const newPw = document.getElementById('pwd-new').value;
        if (!verifyPw(oldPw, u.passwordHash)) return toast('Current password is incorrect.', 'error');
        if (newPw.length < 6) return toast('New password must be 6+ characters.', 'error');
        u.passwordHash = hashPwLocal(newPw);
        logActivity('Changed password');
        saveDB(); e.target.reset();
        toast('Password updated.', 'success');
    });

    document.getElementById('twofa-toggle').addEventListener('change', e => {
        const u = session.user;
        u.twoFA = e.target.checked;
        saveDB(); saveSession(u);
        toast('2FA ' + (u.twoFA ? 'enabled' : 'disabled') + '. You will now need an OTP at login.', u.twoFA ? 'success' : 'info');
        document.getElementById('sec-2fa').textContent = u.twoFA ? 'Active' : 'Off';
    });

    document.getElementById('alerts-toggle').addEventListener('change', e => {
        localStorage.setItem('nb_alerts', e.target.checked ? 'on' : 'off');
        toast('Alerts ' + (e.target.checked ? 'enabled' : 'disabled'), 'info');
    });

    document.getElementById('btn-logout-all').addEventListener('click', () => {
        DB.sessions = DB.sessions.filter(s => s.userId !== session.userId);
        logActivity('Ended all sessions');
        saveDB();
        toast('All other sessions ended.', 'success');
        renderProfile();
    });
}

/* ================= ADMIN ================= */
let adminTab = 'dash';
function renderAdmin() {
    if (session.user.role !== 'Admin') return;
    switchAdminTab(adminTab);
}

function switchAdminTab(name) {
    adminTab = name;
    document.querySelectorAll('#admin-tabs .atab').forEach(t => t.classList.toggle('active', t.dataset.atab === name));
    ['dash', 'users', 'approvals', 'adminloans', 'reports'].forEach(k =>
        document.getElementById('apanel-' + k).classList.toggle('hidden', k !== name));
    ({ dash: adminDash, users: adminUsers, approvals: adminApprovals, adminloans: adminLoans, reports: adminReports })[name]();
}

function adminDash() {
    const customers = DB.customers.length;
    const accounts = DB.accounts.length;
    const deposits = DB.accounts.reduce((s, a) => s + a.balance, 0);
    const disbursed = DB.loans.filter(l => l.status === 'Approved').reduce((s, l) => s + l.amount, 0);
    const pending = DB.accounts.filter(a => a.status === 'Pending').length + DB.loans.filter(l => l.status === 'Pending').length;
    document.getElementById('as-customers').textContent = customers;
    document.getElementById('as-accounts').textContent = accounts;
    document.getElementById('as-deposits').textContent = '₹' + Math.round(deposits / 100000) + 'L';
    document.getElementById('as-loans').textContent = '₹' + Math.round(disbursed / 100000) + 'L';
    document.getElementById('as-pending').textContent = pending;

    /* bar chart: last 6 months txn volume */
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleDateString('en-IN', { month: 'short' }));
    }
    const volumes = months.map(m => {
        const idx = months.indexOf(m);
        const d = new Date(); d.setMonth(d.getMonth() - (5 - idx));
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        return DB.transactions.filter(t => t.date.slice(0, 7) === key).reduce((s, t) => s + t.amount, 0);
    });
    const max = Math.max(...volumes, 1);
    document.getElementById('chart-bars').innerHTML = months.map((m, i) =>
        `<div class="cbar"><div class="fill" style="height:${(volumes[i] / max * 100).toFixed(1)}%"></div><span>${m}</span></div>`).join('');

    /* live record book */
    const recent = [...DB.activityLogs].slice(0, 6);
    document.getElementById('admin-live').innerHTML = recent.map(l =>
        `<div class="list-item border-pink"><div class="li-main"><b>${esc(l.action)}</b><div>${formatDateTime(l.date)}</div></div></div>`).join('');
}

function adminUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = DB.users.map(u => `
        <tr>
            <td><b>${esc(u.name)}</b></td>
            <td>${esc(u.email)}</td>
            <td><span class="badge ${u.role === 'Admin' ? 'active' : 'info'}">${u.role}</span></td>
            <td>${u.twoFA ? '✅' : '—'}</td>
            <td><span class="badge ${u.status === 'Blocked' ? 'blocked' : 'active'}">${u.status}</span></td>
            <td>
                ${u.role === 'User' ? `
                <button class="btn btn-sm btn-ghost" data-role="${u.id}">Make Admin</button>
                <button class="btn btn-sm ${u.status === 'Blocked' ? 'btn-primary' : 'btn-danger'}" data-tog="${u.id}">${u.status === 'Blocked' ? 'Unblock' : 'Block'}</button>` : '<span class="muted">—</span>'}
            </td>
        </tr>`).join('');
    tbody.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => {
        const u = DB.users.find(x => x.id === b.dataset.role);
        u.role = u.role === 'Admin' ? 'User' : 'Admin';
        logActivity('Changed role of ' + u.email);
        saveDB(); adminUsers();
        toast('Role updated.', 'success');
    }));
    tbody.querySelectorAll('[data-tog]').forEach(b => b.addEventListener('click', () => {
        const u = DB.users.find(x => x.id === b.dataset.tog);
        u.status = u.status === 'Blocked' ? 'Active' : 'Blocked';
        logActivity((u.status === 'Blocked' ? 'Blocked ' : 'Unblocked ') + u.email);
        saveDB(); adminUsers();
        toast('User ' + u.status.toLowerCase() + '.', 'success');
    }));
}

function adminApprovals() {
    const pendingAccs = DB.accounts.filter(a => a.status === 'Pending');
    const list = document.getElementById('approval-list');
    list.innerHTML = pendingAccs.length ? pendingAccs.map(a => {
        const cust = DB.customers.find(c => c.id === a.customerId);
        return `<div class="list-item border-pink">
            <div class="li-main">
                <b>${esc(a.type)} — ${a.number}</b>
                <div>${esc(cust ? cust.name : 'Unknown')} · ${esc(a.branch)} · opened ${formatDate(a.createdAt)} · ${formatINR(a.balance)}</div>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-grad" data-approve="${a.id}">Approve</button>
                <button class="btn btn-sm btn-danger" data-reject="${a.id}">Reject</button>
            </div>
        </div>`;
    }).join('') : '<div class="empty">No pending account approvals. 🎉</div>';

    list.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => {
        const a = DB.accounts.find(x => x.id === b.dataset.approve);
        a.status = 'Active';
        addNotification('USR_USER', 'info', 'Account Approved', 'Your ' + a.type + ' account ' + a.number + ' is now active.');
        logActivity('Approved account ' + a.number);
        saveDB(); adminApprovals();
        toast('Account approved.', 'success');
    }));
    list.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => {
        const a = DB.accounts.find(x => x.id === b.dataset.reject);
        a.status = 'Closed';
        addNotification('USR_USER', 'info', 'Application Rejected', a.type + ' account ' + a.number + ' was rejected.');
        logActivity('Rejected account ' + a.number);
        saveDB(); adminApprovals();
        toast('Application rejected.', 'error');
    }));
}

function adminLoans() {
    const tbody = document.getElementById('alloan-tbody');
    tbody.innerHTML = DB.loans.map(l => `
        <tr>
            <td><code>${esc(l.id)}</code></td>
            <td><b>${esc(l.customerName)}</b></td>
            <td>${esc(l.type)}</td>
            <td class="num">${formatINR(l.amount)}</td>
            <td class="num">${formatINR(l.emi)}/mo</td>
            <td><span class="badge ${l.status === 'Approved' ? 'active' : l.status === 'Rejected' ? 'rejected' : 'pending'}">${l.status}</span></td>
            <td>
                ${l.status === 'Pending' ? `
                <button class="btn btn-sm btn-grad" data-lapp="${l.id}">Approve</button>
                <button class="btn btn-sm btn-danger" data-lrej="${l.id}">Reject</button>` : '<span class="muted">—</span>'}
            </td>
        </tr>`).join('') || '<tr><td colspan="7"><div class="empty">No loans.</div></td></tr>';

    tbody.querySelectorAll('[data-lapp]').forEach(b => b.addEventListener('click', () => {
        const l = DB.loans.find(x => x.id === b.dataset.lapp);
        l.status = 'Approved';
        logActivity('Approved loan ' + l.id + ' (' + formatINR(l.amount) + ')');
        saveDB(); adminLoans();
        toast('Loan approved.', 'success');
    }));
    tbody.querySelectorAll('[data-lrej]').forEach(b => b.addEventListener('click', () => {
        const l = DB.loans.find(x => x.id === b.dataset.lrej);
        l.status = 'Rejected';
        logActivity('Rejected loan ' + l.id);
        saveDB(); adminLoans();
        toast('Loan rejected.', 'error');
    }));
}

function adminReports() {
    const byType = {};
    DB.accounts.forEach(a => byType[a.type] = (byType[a.type] || 0) + 1);
    const tot = DB.accounts.length || 1;
    const pct = t => Math.round((byType[t] || 0) / tot * 100);

    const colors = ['#3d7bff', '#ec4899', '#fbbf24'];
    const types = Object.keys(byType);
    let acc = 0;
    const stops = types.map((t, i) => {
        const p = pct(t);
        const from = acc; acc += p;
        return `${colors[i % 3]} ${from}% ${acc}%`;
    });
    const donut = types.length
        ? `<div class="donut" style="background:conic-gradient(${stops.join(', ')})"></div>
           <div class="donut-caption">${types.map((t, i) => `<span style="color:${colors[i % 3]}">■</span> ${esc(t)} ${pct(t)}%`).join(' &nbsp; ')}</div>`
        : '<div class="empty">No accounts yet.</div>';
    document.getElementById('chart-mix-wrap').innerHTML = donut;

    const loanBook = document.getElementById('loan-book');
    const loanTypes = {};
    DB.loans.filter(l => l.status === 'Approved').forEach(l => loanTypes[l.type] = (loanTypes[l.type] || 0) + l.amount);
    loanBook.innerHTML = Object.entries(loanTypes).map(([t, v]) =>
        `<div class="list-item border-pink"><div class="li-main"><b>${esc(t)}</b></div><b class="num">${formatINR(v)}</b></div>`).join('')
        || '<div class="empty">No disbursed loans.</div>';

    const topCusts = [...DB.customers].map(c => ({
        name: c.name,
        total: DB.accounts.filter(a => a.customerId === c.id).reduce((s, a) => s + a.balance, 0)
    })).sort((a, b) => b.total - a.total).slice(0, 5);
    document.getElementById('top-customers').innerHTML = topCusts.map(c =>
        `<div class="list-item"><div class="li-main"><b>${esc(c.name)}</b></div><b class="num">${formatINR(c.total)}</b></div>`).join('');

    const kv = document.getElementById('report-kv');
    const totalTxn = DB.transactions.length;
    const totalVol = DB.transactions.reduce((s, t) => s + t.amount, 0);
    const fdCount = DB.accounts.filter(a => a.type === 'Fixed Deposit').length;
    kv.innerHTML = `
        <div class="kv"><small>Customers</small><b>${DB.customers.length}</b></div>
        <div class="kv"><small>Total Accounts</small><b>${DB.accounts.length}</b></div>
        <div class="kv"><small>Total Transactions</small><b>${totalTxn}</b></div>
        <div class="kv"><small>Transaction Volume</small><b>₹${Math.round(totalVol / 100000)}L</b></div>
        <div class="kv"><small>Active Loans</small><b>${DB.loans.filter(l => l.status === 'Approved').length}</b></div>
        <div class="kv"><small>Fixed Deposits</small><b>${fdCount}</b></div>
        <div class="kv"><small>Cards Issued</small><b>${DB.cards.length}</b></div>
        <div class="kv"><small>Cheque Books</small><b>${DB.chequeRequests.length}</b></div>`;
}

function bindAdmin() {
    document.querySelectorAll('#admin-tabs .atab').forEach(t => t.addEventListener('click', () => switchAdminTab(t.dataset.atab)));
}

/* ================= MODALS ================= */
function openModal(html) {
    const box = document.getElementById('modal-box');
    box.innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
    bindModalClosers();
}
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-box').innerHTML = '';
}
function bindModalClosers() {
    document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
    document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    document.getElementById('otp-modal').addEventListener('click', e => { if (e.target.id === 'otp-modal') { e.target.classList.add('hidden'); otpContext = null; } });
}

/* ================= RANDOM SAMPLE DATA ================= */
function loadRandomSample() {
    const names = ['Aarav', 'Diya', 'Vihaan', 'Ananya', 'Kabir', 'Myra', 'Advait', 'Zoya', 'Ranbir', 'Tara'];
    const lasts = ['Sharma', 'Iyer', 'Patel', 'Nair', 'Singh', 'Mehta', 'Gupta', 'Joshi', 'Kapoor', 'Das'];
    for (let i = 0; i < 6; i++) {
        const name = names[Math.floor(Math.random() * names.length)] + ' ' + lasts[Math.floor(Math.random() * lasts.length)];
        const email = name.toLowerCase().replace(' ', '.') + Math.floor(Math.random() * 90) + '@gmail.com';
        const cust = {
            id: 'CUS' + Math.floor(10000 + Math.random() * 89999), name, email,
            phone: '+91 ' + Math.floor(9000000000 + Math.random() * 999999999),
            address: Math.floor(Math.random() * 400) + ', Sample Street, ' + pick(CITIES) + ' - ' + Math.floor(452001 + Math.random() * 100),
            city: pick(CITIES), dob: '19' + Math.floor(75 + Math.random() * 25) + '-' + String(Math.floor(1 + Math.random() * 12)).padStart(2, '0') + '-1' + Math.floor(Math.random() * 9),
            pan: 'XXXXX' + Math.floor(1000 + Math.random() * 8999) + 'X', kyc: 'Verified', createdAt: todayStr()
        };
        DB.customers.push(cust);
        const type = pick(['Savings', 'Current']);
        const acc = {
            id: uid('acc'), customerId: cust.id, type,
            number: String(Math.floor(10000000000 + Math.random() * 89999999999)),
            ifsc: BANK_INFO.ifsc + '0' + Math.floor(100 + Math.random() * 899),
            branch: 'NovaBank ' + cust.city + ' Branch',
            balance: Math.floor(5000 + Math.random() * 500000),
            rate: type === 'Savings' ? 3.5 : 0, status: 'Active', createdAt: todayStr()
        };
        DB.accounts.push(acc);
        DB.cards.push({
            id: uid('CR'), accountId: acc.id, customerName: name, type: 'Debit', variant: 'Classic',
            number: Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join(' '),
            cvv: String(Math.floor(100 + Math.random() * 900)), expiry: '12/29', pin: String(Math.floor(1000 + Math.random() * 9000)), status: 'Active'
        });
        for (let k = 0; k < 8; k++) DB.transactions.unshift(randomTxn(acc.id, acc.number, 30));
    }
    logActivity('Generated random sample records');
    saveDB();
    toast('6 random customers, accounts & transactions loaded.', 'success');
    renderCustomers();
}

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
    session = loadSession();

    if (!session) {
        showAuth();
        renderHeaderUser();
    } else {
        hideAuth();
        renderHeaderUser();
        renderNav();
        showView('dashboard');
    }

    bindAuth();
    bindTransactions();
    bindLoans();
    bindCards();
    bindServices();
    bindProfile();
    bindAdmin();

    document.getElementById('btn-show-auth') && document.getElementById('btn-show-auth').addEventListener('click', showAuth);
    document.getElementById('btn-open-account').addEventListener('click', openAccountModal);
    document.getElementById('btn-gen-sample').addEventListener('click', loadRandomSample);
    document.getElementById('btn-add-customer').addEventListener('click', addCustomerModal);
    document.getElementById('customer-search').addEventListener('input', renderCustomers);
    document.getElementById('btn-clear-notifs').addEventListener('click', () => {
        DB.notifications = DB.notifications.filter(n => n.userId !== session.userId);
        saveDB(); renderDashboard();
        toast('Notifications cleared.', 'info');
    });
});