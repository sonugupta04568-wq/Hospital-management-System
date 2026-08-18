/* =====================================================================
   PRISMBANK — application logic (login, OTP, CRUD, transactions, loans)
   ===================================================================== */

/* ---------------- DATABASE LAYER (localStorage persistence) --------- */
const DB_KEY = "prismbank_db_v1";
let DB = null;

function seedDB() {
    return {
        branches: JSON.parse(JSON.stringify(Branches)),
        employees: JSON.parse(JSON.stringify(Employees)),
        customers: JSON.parse(JSON.stringify(Customers)),
        accounts: JSON.parse(JSON.stringify(Accounts)),
        transactions: JSON.parse(JSON.stringify(Transactions)),
        loans: JSON.parse(JSON.stringify(Loans)),
        users: JSON.parse(JSON.stringify(Users))
    };
}

function loadDB() {
    try {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) { DB = JSON.parse(raw); return; }
    } catch (e) { /* corrupted -> reseed */ }
    DB = seedDB();
    saveDB();
}
function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(DB)); }
function resetDB() { localStorage.removeItem(DB_KEY); DB = seedDB(); saveDB(); }

/* ---------------- DOM HELPERS ---------------- */
const $ = (id) => document.getElementById(id);
function toast(msg, type) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show " + (type || "");
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = "toast"; }, 3200);
}
function badge(status) {
    const map = { "Active": "b-ok", "Success": "b-ok", "Kyced": "b-ok", "Approved": "b-ok",
        "Pending": "b-warn", "Dormant": "b-warn", "Frozen": "b-warn", "Rejected": "b-bad",
        "Failed": "b-bad", "Closed": "b-bad", "Inactive": "b-bad" };
    const cls = map[status] || "b-info";
    return '<span class="badge ' + cls + '">' + status + "</span>";
}
function avatar(name) {
    const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
    return '<span class="avatar">' + initials + "</span>";
}
function modal(title, bodyHTML, onOpen) {
    $("modal-title").textContent = title;
    $("modal-body").innerHTML = bodyHTML;
    $("modal-overlay").classList.remove("hidden");
    if (onOpen) onOpen();
}
function closeModal() { $("modal-overlay").classList.add("hidden"); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function fld(label, html) { return '<label>' + label + "</label>" + html; }
function sel(id, options, selected, attrs) {
    return '<select id="' + id + '" class="input"' + (attrs || "") + ">" +
        options.map(o => { const v = o.value != null ? o.value : o; return '<option value="' + v + '"' + (v == selected ? " selected" : "") + ">" + esc(o.label != null ? o.label : o) + "</option>"; }).join("") +
        "</select>";
}

/* ---------------- OTP ENGINE ---------------- */
let currentOtp = "";
let otpTimer = null;
let otpSeconds = 120;

function genOtp() { return String(rand ? rand(100000, 999999) : 123456); }

function startOtpTimer(display) {
    clearInterval(otpTimer);
    otpSeconds = 120;
    otpTimer = setInterval(() => {
        otpSeconds--;
        if (display) display.textContent = otpSeconds + "s";
        if (otpSeconds <= 0) { clearInterval(otpTimer); currentOtp = ""; }
    }, 1000);
}

function fillOtpBoxes(code) {
    const boxes = document.querySelectorAll(".otp-inputs .otp-box");
    boxes.forEach((b, i) => { b.value = code[i] || ""; });
}

/* OTP confirmation modal used for high-value transactions */
function confirmOtp(title, onSuccess) {
    const code = genOtp();
    currentOtp = code;
    startOtpTimer(null);
    modal(title,
        '<p class="muted">A 6-digit OTP has been sent to the registered mobile number. (Demo: code shown below)</p>' +
        '<div class="demo-otp">DEMO OTP: <span>' + code + '</span></div>' +
        '<div class="otp-inputs">' + Array.from({ length: 6 }, (_, i) => '<input type="text" maxlength="1" class="otp-box" inputmode="numeric" data-i="' + i + '">').join("") + "</div>" +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" id="m-otp-cancel">Cancel</button>' +
        '<button class="btn btn-grad" id="m-otp-ok">Verify OTP</button></div>');
    wireOtpInputs();
    $("m-otp-cancel").onclick = closeModal;
    $("m-otp-ok").onclick = () => {
        const val = Array.from(document.querySelectorAll("#modal-body .otp-box")).map(b => b.value).join("");
        if (val === code) { closeModal(); toast("OTP verified ✓", "ok"); onSuccess(); }
        else toast("Incorrect OTP. Please try again.", "err");
    };
}

function wireOtpInputs() {
    document.querySelectorAll(".otp-inputs .otp-box").forEach(box => {
        box.addEventListener("input", () => {
            box.value = box.value.replace(/\D/g, "");
            const next = box.nextElementSibling;
            if (box.value && next && next.classList.contains("otp-box")) next.focus();
        });
        box.addEventListener("keydown", e => {
            if (e.key === "Backspace" && !box.value) {
                const prev = box.previousElementSibling;
                if (prev && prev.classList.contains("otp-box")) prev.focus();
            }
        });
    });
}

/* ---------------- AUTH ---------------- */
let session = null;

function showLogin() { $("login-screen").classList.remove("hidden"); $("app-screen").classList.add("hidden"); }
function showApp() {
    $("login-screen").classList.add("hidden");
    $("app-screen").classList.remove("hidden");
    $("side-user").innerHTML = avatar(session.name) + "<b>" + esc(session.name) + "</b>" + session.role;
    showView("dashboard");
    startClock();
}

function startClock() {
    const tick = () => {
        $("clock").textContent = new Date().toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };
    tick();
    setInterval(tick, 1000);
}

/* ---------------- VIEW ROUTER ---------------- */
let currentView = "";

function showView(view) {
    currentView = view;
    document.querySelectorAll(".side-link").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    const renderers = {
        dashboard: renderDashboard,
        customers: renderCustomers,
        branches: renderBranches,
        employees: renderEmployees,
        loans: renderLoans,
        transactions: renderTransactions,
        reports: renderReports
    };
    renderers[view]();
    window.scrollTo(0, 0);
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
function renderDashboard() {
    const totalBal = DB.accounts.reduce((s, a) => s + a.balance, 0);
    const loansActive = DB.loans.filter(l => l.status === "Active");
    const recent = DB.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const topBranches = DB.branches.slice()
        .map(b => {
            const staff = DB.employees.filter(e => e.branchId === b.id).length;
            const cust = DB.customers.filter(c => c.branchId === b.id).length;
            const dep = DB.accounts.filter(a => a.branchId === b.id).reduce((s, a) => s + a.balance, 0);
            return { b, staff, cust, dep };
        })
        .sort((x, y) => y.dep - x.dep).slice(0, 5);

    $("content").innerHTML =
        '<div class="view">' +
        '<div class="view-head"><div><h2>Bank Overview</h2><p>Live snapshot of PrismBank\u2019s core database.</p></div>' +
        '<div><button class="btn btn-ghost btn-sm" id="btn-reset">↺ Reset Sample Data</button></div></div>' +

        '<div class="stats">' +
        stat("🏦", DB.customers.length, "Customers") +
        stat("💳", DB.accounts.length, "Accounts") +
        stat("💰", fmtINR(totalBal), "Total Deposits") +
        stat("🏛️", DB.branches.length, "Branches") +
        '</div>' +
        '<div class="stats">' +
        stat("👷", DB.employees.length, "Employees") +
        stat("💸", loansActive.length, "Active Loans") +
        stat("📈", fmtINR(loansActive.reduce((s, l) => s + l.amount, 0)), "Loan Book") +
        stat("🔁", DB.transactions.length, "Transactions Logged") +
        '</div>' +

        '<div class="grid-2">' +
        '<div class="card"><h3>Recent Transactions</h3><p class="muted">Latest 8 entries in the ledger.</p>' +
        '<div class="table-wrap"><table><thead><tr><th>Ref</th><th>Account</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead><tbody>' +
        recent.map(t => "<tr><td>" + esc(t.refNo) + "</td><td><span class='acct-chip'>" + esc(t.acctNo) + "</span></td><td>" + badge(t.status) + " " + esc(t.type) + "</td><td style='color:" + (t.credit ? "#2dd48f" : "#ff5d73") + ";font-weight:700'>" + (t.credit ? "+" : "−") + fmtINR(t.amount) + "</td><td class='muted'>" + esc(t.date) + "</td></tr>").join("") +
        "</tbody></table></div></div>" +

        '<div class="card"><h3>Top Performing Branches</h3><p class="muted">Ranked by total deposits.</p>' +
        '<table><thead><tr><th>Branch</th><th>IFSC</th><th>Customers</th><th>Staff</th><th>Deposits</th></tr></thead><tbody>' +
        topBranches.map(r => "<tr><td>" + esc(r.b.name) + "</td><td><span class='acct-chip'>" + esc(r.b.ifsc) + "</span></td><td>" + r.cust + "</td><td>" + r.staff + "</td><td style='color:#6ea1ff;font-weight:700'>" + fmtINR(r.dep) + "</td></tr>").join("") +
        "</tbody></table>" +
        '<div style="margin-top:16px" class="card-flex"><span class="muted">Quick access:</span>' +
        '<div>' +
        '<button class="btn btn-sm btn-ghost" data-go="customers">👥 Customers</button> ' +
        '<button class="btn btn-sm btn-ghost" data-go="branches">🏛️ Branches</button> ' +
        '<button class="btn btn-sm btn-ghost" data-go="loans">💸 Loans</button> ' +
        '<button class="btn btn-sm btn-ghost" data-go="reports">📊 Reports</button></div></div>' +
        "</div></div></div>";

    $("btn-reset").onclick = () => { resetDB(); toast("Database reset to random sample data ✓", "ok"); renderDashboard(); };
    document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => showView(b.dataset.go));
}

function stat(ico, num, label) {
    return '<div class="stat"><div class="s-ico">' + ico + '</div><div class="s-num">' + num + '</div><div class="s-label">' + label + "</div></div>";
}

/* =====================================================================
   CUSTOMERS
   ===================================================================== */
function renderCustomers() {
    const q = ($("cs-q") ? $("cs-q").value : "").toLowerCase();
    const rows = DB.customers.filter(c => !q || (c.name + c.email + c.phone + c.city + c.custNo).toLowerCase().includes(q))
        .sort((a, b) => b.id - a.id);

    $("content").innerHTML =
        '<div class="view">' +
        '<div class="view-head"><div><h2>Customers</h2><p>Customer master — name, ID, contact &amp; KYC records.</p></div>' +
        '<button class="btn btn-grad" id="cust-add">+ Add Customer</button></div>' +
        '<div class="toolbar"><input id="cs-q" class="input" placeholder="Search by name, email, phone, city, ID…">' +
        '<span class="muted">' + rows.length + " records</span></div>" +
        '<div class="table-wrap"><table><thead><tr><th>Customer ID</th><th>Name</th><th>Contact</th><th>Email</th><th>City</th><th>Branch</th><th>Accounts</th><th>Total Bal</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
        (rows.length ? rows.map(c => {
            const accs = DB.accounts.filter(a => a.custId === c.id);
            const bal = accs.reduce((s, a) => s + a.balance, 0);
            return "<tr><td><b>" + esc(c.custNo) + "</b></td>" +
                "<td>" + avatar(c.name) + "<b>" + esc(c.name) + "</b><br><span class='muted'>" + esc(c.email) + "</span></td>" +
                "<td>" + esc(c.phone) + "</td>" +
                "<td class='muted'>" + esc(c.email) + "</td>" +
                "<td>" + esc(c.city) + "</td>" +
                "<td class='muted'>" + esc(branchName(c.branchId)) + "</td>" +
                "<td>" + accs.length + "</td>" +
                "<td style='color:#6ea1ff;font-weight:700'>" + fmtINR(bal) + "</td>" +
                "<td>" + badge(c.status) + "</td>" +
                "<td><button class='btn btn-sm btn-ghost' data-edit='" + c.id + "'>Edit</button> <button class='btn btn-sm btn-danger' data-del='" + c.id + "'>✕</button></td></tr>";
        }).join("") : '<tr><td colspan="10"><div class="empty">No customers match your search.</div></td></tr>') +
        "</tbody></table></div></div>";

    $("cs-q").oninput = renderCustomers;
    $("cust-add").onclick = () => customerModal();
    document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => customerModal(Number(b.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => delCustomer(Number(b.dataset.del)));
}

function customerModal(id) {
    const c = id ? DB.customers.find(x => x.id === id) : null;
    modal(c ? "Edit Customer" : "Add Customer",
        fld("Full Name *", '<input id="f-name" class="input" value="' + esc(c ? c.name : "") + '">') +
        fld("Email *", '<input id="f-email" class="input" value="' + esc(c ? c.email : "") + '">') +
        fld("Mobile / Contact Number *", '<input id="f-phone" class="input" value="' + esc(c ? c.phone : "") + '" placeholder="+91 98xxx xxxxx">') +
        fld("City", '<input id="f-city" class="input" value="' + esc(c ? c.city : "") + '">') +
        fld("Address", '<input id="f-address" class="input" value="' + esc(c ? c.address : "") + '">') +
        fld("Date of Birth", '<input id="f-dob" type="date" class="input" value="' + (c ? c.dob : "") + '">') +
        fld("Aadhaar (12 digit)", '<input id="f-aadhaar" class="input" maxlength="12" value="' + esc(c ? c.aadhaar : "") + '">') +
        fld("Home Branch", sel("f-branch", DB.branches.map(b => ({ label: b.name + " (" + b.ifsc + ")", value: b.id })), c ? c.branchId : DB.branches[0].id)) +
        fld("Status", sel("f-status", ["Active", "Dormant"], c ? c.status : "Active")) +
        fld("KYC Verified", sel("f-kyc", [{ label: "Yes", value: "1" }, { label: "No", value: "0" }], c ? (c.kyced ? "1" : "0") : "1")) +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-grad" id="f-save">Save Customer</button></div>');

    $("f-save").onclick = () => {
        const name = $("f-name").value.trim();
        if (!name || !$("f-email").value.trim() || !$("f-phone").value.trim()) return toast("Name, email and phone are required.", "err");
        if (!c) {
            const newId = Math.max(0, ...DB.customers.map(x => x.id)) + 1;
            DB.customers.push({
                id: newId, custNo: "PRM-C" + String(5001 + newId).padStart(4, "0"),
                name, email: $("f-email").value.trim(), phone: $("f-phone").value.trim(),
                city: $("f-city").value.trim() || "—", address: $("f-address").value.trim(),
                dob: $("f-dob").value || daysAgo(12000), aadhaar: $("f-aadhaar").value || String(Math.floor(Math.random() * 1e12)).padStart(12, "0"),
                branchId: Number($("f-branch").value), kyced: $("f-kyc").value === "1",
                opened: daysAgo(0), status: $("f-status").value, balance: 0
            });
            toast("Customer registered — OTP sent to " + esc($("f-phone").value), "ok");
        } else {
            c.name = name; c.email = $("f-email").value.trim(); c.phone = $("f-phone").value.trim();
            c.city = $("f-city").value.trim() || "—"; c.address = $("f-address").value.trim();
            c.dob = $("f-dob").value || c.dob; c.aadhaar = $("f-aadhaar").value || c.aadhaar;
            c.branchId = Number($("f-branch").value); c.kyced = $("f-kyc").value === "1"; c.status = $("f-status").value;
            toast("Customer updated ✓", "ok");
        }
        saveDB(); closeModal(); renderCustomers();
    };
}

function delCustomer(id) {
    const accs = DB.accounts.filter(a => a.custId === id).length;
    modal("Delete Customer", '<p>Delete <b>' + esc(custName(id)) + "</b>? This will also remove " + accs + " linked account(s), associated transactions and loans.</p>" +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-danger" id="f-deld">Delete Permanently</button></div>');
    $("f-deld").onclick = () => {
        DB.customers = DB.customers.filter(x => x.id !== id);
        DB.accounts = DB.accounts.filter(x => x.custId !== id);
        DB.transactions = DB.transactions.filter(x => x.custId !== id);
        DB.loans = DB.loans.filter(x => x.custId !== id);
        saveDB(); closeModal(); toast("Customer deleted.", "ok"); renderCustomers();
    };
}

/* =====================================================================
   BRANCHES
   ===================================================================== */
function renderBranches() {
    const q = ($("br-q") ? $("br-q").value : "").toLowerCase();
    const rows = DB.branches.filter(b => !q || (b.name + b.ifsc + b.city + b.brCode).toLowerCase().includes(q));

    $("content").innerHTML =
        '<div class="view">' +
        '<div class="view-head"><div><h2>Branches</h2><p>Branch network — IFSC, MICR, rates &amp; headcount.</p></div>' +
        '<button class="btn btn-grad" id="br-add">+ Add Branch</button></div>' +
        '<div class="toolbar"><input id="br-q" class="input" placeholder="Search by branch name, IFSC, city, code…">' +
        '<span class="muted">' + rows.length + " branches</span></div>" +
        '<div class="table-wrap"><table><thead><tr><th>Code</th><th>Branch</th><th>IFSC / MICR</th><th>City</th><th>Phone</th><th>Savings %</th><th>FD %</th><th>Staff</th><th>Opened</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
        (rows.length ? rows.map(b => {
            const staff = DB.employees.filter(e => e.branchId === b.id).length;
            return "<tr><td><b>" + esc(b.brCode) + "</b></td><td>" + esc(b.name) + "<br><span class='muted'>" + esc(b.address) + "</span></td>" +
                "<td><span class='acct-chip'>" + esc(b.ifsc) + "</span><br><span class='muted'>" + esc(b.micr) + "</span></td>" +
                "<td>" + esc(b.city) + "</td><td class='muted'>" + esc(b.phone) + "</td>" +
                "<td>" + b.swRate + "%</td><td>" + b.fdRate + "%</td><td>" + staff + "</td>" +
                "<td class='muted'>" + b.opened + "</td><td>" + badge(b.active ? "Active" : "Inactive") + "</td>" +
                "<td><button class='btn btn-sm btn-ghost' data-edit='" + b.id + "'>Edit</button> <button class='btn btn-sm btn-danger' data-del='" + b.id + "'>✕</button></td></tr>";
        }).join("") : '<tr><td colspan="11"><div class="empty">No branches found.</div></td></tr>') +
        "</tbody></table></div></div>";

    $("br-q").oninput = renderBranches;
    $("br-add").onclick = () => branchModal();
    document.querySelectorAll("[data-edit]").forEach(x => x.onclick = () => branchModal(Number(x.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach(x => x.onclick = () => delBranch(Number(x.dataset.del)));
}

function branchModal(id) {
    const b = id ? DB.branches.find(x => x.id === id) : null;
    modal(b ? "Edit Branch" : "Add Branch",
        fld("Branch Name *", '<input id="f-name" class="input" value="' + esc(b ? b.name : "Prism Bank — ") + '">') +
        fld("City *", '<input id="f-city" class="input" value="' + esc(b ? b.city : "") + '">') +
        fld("Address", '<input id="f-address" class="input" value="' + esc(b ? b.address : "") + '">') +
        fld("Phone", '<input id="f-phone" class="input" value="' + esc(b ? b.phone : "") + '">') +
        fld("IFSC", '<input id="f-ifsc" class="input" value="' + esc(b ? b.ifsc : "") + '">') +
        fld("Savings Rate (%)", '<input id="f-sw" type="number" step="0.01" class="input" value="' + (b ? b.swRate : 4.0) + '">') +
        fld("FD Rate (%)", '<input id="f-fd" type="number" step="0.01" class="input" value="' + (b ? b.fdRate : 7.1) + '">') +
        fld("Status", sel("f-status", ["Active", "Inactive"], b ? (b.active ? "Active" : "Inactive") : "Active")) +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-grad" id="f-save">Save Branch</button></div>');

    $("f-save").onclick = () => {
        if (!$("f-name").value.trim() || !$("f-city").value.trim()) return toast("Branch name and city required.", "err");
        if (b) {
            b.name = $("f-name").value.trim(); b.city = $("f-city").value.trim();
            b.address = $("f-address").value.trim() || b.address; b.phone = $("f-phone").value.trim() || b.phone;
            b.ifsc = $("f-ifsc").value.trim() || b.ifsc; b.swRate = Number($("f-sw").value); b.fdRate = Number($("f-fd").value);
            b.active = $("f-status").value === "Active";
        } else {
            const nid = Math.max(0, ...DB.branches.map(x => x.id)) + 1;
            DB.branches.push({
                id: nid, brCode: "PR" + (1000 + nid), name: $("f-name").value.trim(),
                ifsc: $("f-ifsc").value.trim() || "PRMB0" + String(100 + nid), micr: "4000" + nid + "01",
                city: $("f-city").value.trim(), address: $("f-address").value.trim(),
                phone: $("f-phone").value.trim(), swRate: Number($("f-sw").value), fdRate: Number($("f-fd").value),
                opened: new Date().getFullYear(), active: $("f-status").value === "Active"
            });
        }
        saveDB(); closeModal(); toast("Branch saved ✓", "ok"); renderBranches();
    };
}

function delBranch(id) {
    modal("Delete Branch", "<p>Delete <b>" + esc(branchName(id)) + "</b>? Its " + DB.employees.filter(e => e.branchId === id).length + " employee(s) and " + DB.customers.filter(c => c.branchId === id).length + " customer(s) will be moved to the head office branch.</p>" +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-danger" id="f-deld">Delete Branch</button></div>');
    $("f-deld").onclick = () => {
        const ho = DB.branches.find(x => x.id !== id) || null;
        if (ho) { DB.employees.forEach(e => { if (e.branchId === id) e.branchId = ho.id; }); DB.customers.forEach(c => { if (c.branchId === id) c.branchId = ho.id; }); DB.accounts.forEach(a => { if (a.branchId === id) a.branchId = ho.id; }); }
        DB.branches = DB.branches.filter(x => x.id !== id);
        saveDB(); closeModal(); toast("Branch deleted.", "ok"); renderBranches();
    };
}

/* =====================================================================
   EMPLOYEES
   ===================================================================== */
function renderEmployees() {
    const q = ($("em-q") ? $("em-q").value : "").toLowerCase();
    const rows = DB.employees.filter(e => !q || (e.name + e.email + e.designation + e.department + e.empNo).toLowerCase().includes(q))
        .sort((a, b) => b.id - a.id);

    $("content").innerHTML =
        '<div class="view">' +
        '<div class="view-head"><div><h2>Employees</h2><p>Bank staff registry — departments, salary &amp; assignments.</p></div>' +
        '<button class="btn btn-grad" id="em-add">+ Add Employee</button></div>' +
        '<div class="toolbar"><input id="em-q" class="input" placeholder="Search by name, designation, department, ID…">' +
        '<span class="muted">' + rows.length + " employees</span></div>" +
        '<div class="table-wrap"><table><thead><tr><th>Emp No</th><th>Employee</th><th>Designation</th><th>Department</th><th>Branch</th><th>Salary</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
        (rows.length ? rows.map(e =>
            "<tr><td><b>" + esc(e.empNo) + "</b></td>" +
            "<td>" + avatar(e.name) + "<b>" + esc(e.name) + "</b><br><span class='muted'>" + esc(e.email) + "</span></td>" +
            "<td>" + (e.manager ? '<span class="badge b-pink">' + esc(e.designation) + "</span>" : esc(e.designation)) + "</td>" +
            "<td>" + esc(e.department) + "</td>" +
            "<td class='muted'>" + esc(branchName(e.branchId)) + "</td>" +
            "<td style='color:#6ea1ff;font-weight:700'>" + fmtINR(e.salary) + "/mo</td>" +
            "<td class='muted'>" + esc(e.joined) + "</td>" +
            "<td>" + badge(e.active ? "Active" : "Inactive") + "</td>" +
            "<td><button class='btn btn-sm btn-ghost' data-edit='" + e.id + "'>Edit</button> <button class='btn btn-sm btn-danger' data-del='" + e.id + "'>✕</button></td></tr>").join("")
            : '<tr><td colspan="9"><div class="empty">No employees found.</div></td></tr>') +
        "</tbody></table></div></div>";

    $("em-q").oninput = renderEmployees;
    $("em-add").onclick = () => employeeModal();
    document.querySelectorAll("[data-edit]").forEach(x => x.onclick = () => employeeModal(Number(x.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach(x => x.onclick = () => delEmployee(Number(x.dataset.del)));
}

function employeeModal(id) {
    const e = id ? DB.employees.find(x => x.id === id) : null;
    modal(e ? "Edit Employee" : "Add Employee",
        fld("Full Name *", '<input id="f-name" class="input" value="' + esc(e ? e.name : "") + '">') +
        fld("Email", '<input id="f-email" class="input" value="' + esc(e ? e.email : "") + '">') +
        fld("Contact Number", '<input id="f-phone" class="input" value="' + esc(e ? e.phone : "") + '">') +
        fld("Designation *", '<input id="f-desig" class="input" value="' + esc(e ? e.designation : "Teller") + '">') +
        fld("Department", sel("f-dept", DEPARTMENTS.concat(["Branch Management"]), e ? e.department : "Operations")) +
        fld("Branch", sel("f-branch", DB.branches.map(b => ({ label: b.name, value: b.id })), e ? e.branchId : DB.branches[0].id)) +
        fld("Monthly Salary (₹)", '<input id="f-salary" type="number" class="input" value="' + (e ? e.salary : 40000) + '">') +
        fld("Status", sel("f-status", ["Active", "Inactive"], e ? (e.active ? "Active" : "Inactive") : "Active")) +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-grad" id="f-save">Save Employee</button></div>');

    $("f-save").onclick = () => {
        if (!$("f-name").value.trim()) return toast("Employee name required.", "err");
        if (e) {
            e.name = $("f-name").value.trim(); e.email = $("f-email").value.trim() || e.email;
            e.phone = $("f-phone").value.trim() || e.phone; e.designation = $("f-desig").value.trim();
            e.department = $("f-dept").value; e.branchId = Number($("f-branch").value);
            e.salary = Number($("f-salary").value); e.active = $("f-status").value === "Active";
        } else {
            const nid = Math.max(0, ...DB.employees.map(x => x.id)) + 1;
            DB.employees.push({
                id: nid, empNo: "PRM-E" + String(2001 + nid).padStart(4, "0"),
                name: $("f-name").value.trim(), email: $("f-email").value.trim(),
                phone: $("f-phone").value.trim(), designation: $("f-desig").value.trim(),
                department: $("f-dept").value, branchId: Number($("f-branch").value),
                salary: Number($("f-salary").value), joined: daysAgo(0), manager: false, active: $("f-status").value === "Active"
            });
        }
        saveDB(); closeModal(); toast("Employee saved ✓", "ok"); renderEmployees();
    };
}

function delEmployee(id) {
    modal("Delete Employee", "<p>Remove <b>" + esc(DB.employees.find(x => x.id === id).name) + "</b> from the staff registry?</p>" +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-danger" id="f-deld">Remove</button></div>');
    $("f-deld").onclick = () => {
        DB.employees = DB.employees.filter(x => x.id !== id);
        saveDB(); closeModal(); toast("Employee removed.", "ok"); renderEmployees();
    };
}

/* =====================================================================
   LOANS
   ===================================================================== */
function renderLoans() {
    const rows = DB.loans.slice().sort((a, b) => b.id - a.id);
    const active = rows.filter(l => l.status === "Active");

    $("content").innerHTML =
        '<div class="view">' +
        '<div class="view-head"><div><h2>Loans</h2><p>Loan book — applications, EMI schedule &amp; sanctions.</p></div></div>' +
        '<div class="stats">' +
        stat("📋", rows.length, "Total Applications") +
        stat("✅", active.length, "Active Loans") +
        stat("💰", fmtINR(active.reduce((s, l) => s + l.amount, 0)), "Outstanding Principal") +
        stat("📆", fmtINR(active.reduce((s, l) => s + l.emi, 0)), "Monthly EMI Inflow") +
        "</div>" +
        '<div class="grid-2">' +
        '<div class="card"><h3>Apply for a Loan</h3><p class="muted">New application form (requires customer ID).</p>' +
        fld("Customer", sel("l-cust", DB.customers.map(c => ({ label: c.custNo + " — " + c.name, value: c.id })), DB.customers[0] && DB.customers[0].id)) +
        fld("Loan Type", sel("l-type", LOAN_TYPES, "Personal Loan")) +
        fld("Amount (₹)", '<input id="l-amt" type="number" class="input" value="500000">') +
        fld("Tenure (Months)", '<input id="l-ten" type="number" class="input" value="60">') +
        fld("Purpose", '<input id="l-purp" class="input" placeholder="Why is this loan needed?">') +
        '<button class="btn btn-grad btn-block" id="l-submit">Submit Application →</button></div>' +

        '<div class="card"><h3>EMI Calculator</h3><p class="muted">Instant equated monthly instalment computation.</p>' +
        fld("Principal (₹)", '<input id="e-p" type="number" class="input" value="500000">') +
        fld("Annual Rate (%)", '<input id="e-r" type="number" step="0.1" class="input" value="10.5">') +
        fld("Tenure (Months)", '<input id="e-n" type="number" class="input" value="60">') +
        '<button class="btn btn-pink btn-block" id="e-calc">Calculate EMI →</button>' +
        '<div class="emi-result" id="e-out">Enter values and press Calculate.</div></div></div>' +

        '<div class="card"><h3>Loan Applications</h3><p class="muted">All applications across the network.</p>' +
        '<div class="table-wrap"><table><thead><tr><th>Loan No</th><th>Customer</th><th>Type</th><th>Amount</th><th>Tenure</th><th>Rate</th><th>EMI</th><th>Applied</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
        rows.map(l => "<tr><td><b>" + esc(l.loanNo) + "</b></td>" +
            "<td>" + esc(custName(l.custId)) + "<br><span class='muted'>" + esc(getCustomer(l.custId) ? getCustomer(l.custId).custNo : "") + "</span></td>" +
            "<td>" + esc(l.type) + "</td>" +
            "<td style='color:#6ea1ff;font-weight:700'>" + fmtINR(l.amount) + "</td>" +
            "<td>" + l.tenure + " mo</td><td>" + l.rate + "%</td>" +
            "<td style='color:#ff7ac2;font-weight:700'>" + fmtINR(l.emi) + "</td>" +
            "<td class='muted'>" + esc(l.applied) + "</td>" +
            "<td>" + badge(l.status) + "</td>" +
            "<td>" + (l.status === "Pending"
                ? '<button class="btn btn-sm btn-primary" data-ok="' + l.id + '">Approve</button> <button class="btn btn-sm btn-danger" data-no="' + l.id + '">Reject</button>'
                : l.status === "Active" ? '<button class="btn btn-sm btn-ghost" data-close="' + l.id + '">Close</button>'
                : '<span class="muted">—</span>') + "</td></tr>").join("") +
        "</tbody></table></div></div></div>";

    $("l-submit").onclick = () => {
        const custId = Number($("l-cust").value);
        const amount = Number($("l-amt").value);
        const tenure = Number($("l-ten").value);
        if (!amount || amount < 1000) return toast("Enter a valid loan amount (min ₹1,000).", "err");
        confirmOtp("Approve Loan Application", () => {
            const rates = { "Home Loan": 8.5, "Personal Loan": 12.9, "Car Loan": 9.3, "Education Loan": 10.6, "Business Loan": 13.5, "Gold Loan": 7.9 };
            const r = rates[$("l-type").value] / 100 / 12;
            const emi = (amount * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
            const nid = Math.max(0, ...DB.loans.map(x => x.id)) + 1;
            DB.loans.push({
                id: nid, loanNo: "PRM-L" + String(7001 + nid).padStart(4, "0"), custId,
                type: $("l-type").value, amount, tenure, rate: Math.round(r * 1200 * 100) / 100,
                emi: Math.round(emi), status: "Pending", applied: daysAgo(0),
                purpose: $("l-purp").value.trim() || "—"
            });
            saveDB(); renderLoans();
            toast("Loan application " + esc(DB.loans.find(x => x.id === nid).loanNo) + " submitted ✓", "ok");
        });
    };

    $("e-calc").onclick = () => {
        const P = Number($("e-p").value), R = Number($("e-r").value) / 100 / 12, N = Number($("e-n").value);
        if (!P || !N || R <= 0) return toast("Enter valid principal, rate and tenure.", "err");
        const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
        const total = emi * N;
        $("e-out").innerHTML = "Monthly EMI: <b>" + fmtINR(Math.round(emi)) + "</b><br>Total Payable: <span>" + fmtINR(Math.round(total)) + "</span><br>Interest Component: <span>" + fmtINR(Math.round(total - P)) + "</span>";
    };

    document.querySelectorAll("[data-ok]").forEach(x => x.onclick = () => setLoanStatus(Number(x.dataset.ok), "Active", "Loan approved ✓"));
    document.querySelectorAll("[data-no]").forEach(x => x.onclick = () => setLoanStatus(Number(x.dataset.no), "Rejected", "Loan rejected."));
    document.querySelectorAll("[data-close]").forEach(x => x.onclick = () => setLoanStatus(Number(x.dataset.close), "Closed", "Loan marked closed ✓"));
}

function setLoanStatus(id, status, msg) {
    const l = DB.loans.find(x => x.id === id);
    if (l) { l.status = status; saveDB(); toast(msg, "ok"); renderLoans(); }
}

/* =====================================================================
   TRANSACTIONS
   ===================================================================== */
function renderTransactions() {
    const q = ($("t-q") ? $("t-q").value : "").toLowerCase();
    const f = $("t-f") ? $("t-f").value : "";
    const rows = DB.transactions.slice()
        .filter(t => (!f || t.type === f) && (!q || (t.refNo + t.acctNo + t.desc + custName(t.custId)).toLowerCase().includes(q)))
        .sort((a, b) => b.date.localeCompare(a.date));

    $("content").innerHTML =
        '<div class="view">' +
        '<div class="view-head"><div><h2>Transactions</h2><p>Ledger — deposit, withdraw, transfer &amp; UPI pay. High-value ops require OTP.</p></div></div>' +

        '<div class="card"><h3>Perform Transaction</h3><p class="muted">Move money across accounts in the core ledger.</p>' +
        '<div class="grid-2">' +
        '<div>' +
        fld("Account *", sel("t-acct", DB.accounts.map(a => ({ label: a.acctNo + " — " + a.type + " (" + custName(a.custId) + ")", value: a.acctNo })), DB.accounts[0] && DB.accounts[0].acctNo)) +
        fld("Type *", sel("t-type", ["Deposit", "Withdrawal", "Transfer", "UPI Pay"], "Deposit")) +
        fld("Amount (₹) *", '<input id="t-amt" type="number" class="input" placeholder="e.g. 5000">') +
        fld("Description", '<input id="t-desc" class="input" placeholder="Optional note">') +
        '<button class="btn btn-grad btn-block" id="t-run">Execute Transaction</button>' +
        "</div>" +
        '<div class="card" style="background:transparent;border:none;box-shadow:none"><h3>Live Balance</h3><p class="muted">Selected account balance updates instantly.</p>' +
        '<div class="emi-result"><b id="t-bal">' + fmtINR(DB.accounts[0] ? DB.accounts[0].balance : 0) + "</b><br><span id='t-acct-info' class='muted'></span></div></div>" +
        "</div></div>" +

        '<div class="card"><div class="card-flex"><h3>Transaction History</h3><span class="muted">' + rows.length + " entries</span></div>" +
        '<div class="toolbar"><input id="t-q" class="input" placeholder="Search ref, account, customer, description…">' +
        sel("t-f", [{ label: "All Types", value: "" }].concat(TXN_TYPES.map(t => ({ label: t, value: t }))), f) +
        "</div>" +
        '<div class="table-wrap"><table><thead><tr><th>Ref No</th><th>Date</th><th>Account</th><th>Customer</th><th>Type</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
        (rows.length ? rows.map(t =>
            "<tr><td>" + esc(t.refNo) + "</td><td class='muted'>" + esc(t.date) + "</td>" +
            "<td><span class='acct-chip'>" + esc(t.acctNo) + "</span></td>" +
            "<td>" + esc(custName(t.custId)) + "</td>" +
            "<td>" + esc(t.type) + "</td><td class='muted'>" + esc(t.desc) + "</td>" +
            "<td style='color:" + (t.credit ? "#2dd48f" : "#ff5d73") + ";font-weight:700'>" + (t.credit ? "+" : "−") + fmtINR(t.amount) + "</td>" +
            "<td>" + badge(t.status) + "</td></tr>").join("")
            : '<tr><td colspan="8"><div class="empty">No transactions found.</div></td></tr>') +
        "</tbody></table></div></div></div>";

    $("t-acct").onchange = () => {
        const a = getAccountByNo($("t-acct").value);
        $("t-bal").textContent = fmtINR(a.balance);
        $("t-acct-info").textContent = "Holder: " + custName(a.custId) + " · Branch: " + branchName(a.branchId);
    };
    $("t-acct").onchange();
    $("t-q").oninput = renderTransactions;
    $("t-f").onchange = renderTransactions;

    $("t-run").onclick = () => {
        const acctNo = $("t-acct").value;
        const acct = getAccountByNo(acctNo);
        const type = $("t-type").value;
        const amt = Number($("t-amt").value);
        if (!amt || amt <= 0) return toast("Enter a valid amount.", "err");

        const execute = () => {
            const credit = type === "Deposit";
            if (!credit && amt > acct.balance) return toast("Insufficient balance in " + acctNo + ".", "err");
            acct.balance = Math.round((acct.balance + (credit ? amt : -amt)) * 100) / 100;
            const nid = Math.max(0, ...DB.transactions.map(x => x.id)) + 1;
            DB.transactions.push({
                id: nid, refNo: "PRMTXN" + String(900001 + nid).padStart(6, "0"),
                acctNo, custId: acct.custId, date: daysAgo(0), type,
                desc: $("t-desc").value.trim() || (type + " processed"), amount: amt,
                credit, status: "Success", balanceAfter: acct.balance
            });
            saveDB();
            $("t-bal").textContent = fmtINR(acct.balance);
            toast(type + " of " + fmtINR(amt) + " successful ✓", "ok");
            renderTransactions();
        };

        if (type === "Deposit" || type === "Withdrawal") execute();
        else confirmOtp("Verify " + type, execute);
    };
}

/* =====================================================================
   REPORTS
   ===================================================================== */
function renderReports() {
    /* monthly volume for last 6 months */
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
        const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        months.push({ key, label: d.toLocaleString("en", { month: "short" }), total: 0, count: 0 });
    }
    DB.transactions.forEach(t => {
        const m = months.find(x => t.date.startsWith(x.key));
        if (m && t.status === "Success") { m.total += t.amount; m.count++; }
    });
    const max = Math.max(1000, ...months.map(m => m.total));

    const loansByType = LOAN_TYPES.map(t => ({ type: t, n: DB.loans.filter(l => l.type === t && l.status !== "Rejected").length }));
    const topCust = DB.customers.map(c => ({
        c, bal: DB.accounts.filter(a => a.custId === c.id).reduce((s, a) => s + a.balance, 0)
    })).sort((a, b) => b.bal - a.bal).slice(0, 5);

    const totBal = DB.accounts.reduce((s, a) => s + a.balance, 0);
    const mix = ACC_TYPES.map(t => {
        const n = DB.accounts.filter(a => a.type === t).length;
        return { t, n, pct: DB.accounts.length ? Math.round(n / DB.accounts.length * 100) : 0 };
    });

    $("content").innerHTML =
        '<div class="view">' +
        '<div class="view-head"><div><h2>Reports &amp; Analytics</h2><p>Aggregated intelligence over the core database.</p></div></div>' +
        '<div class="grid-2">' +
        '<div class="card"><h3>Monthly Transaction Volume (₹)</h3><p class="muted">Last 6 months of successful movement.</p>' +
        '<div class="chart">' + months.map(m =>
            '<div class="bar"><div class="bar-fill" style="height:' + Math.max(4, Math.round(m.total / max * 100)) + '%" title="' + fmtINR(m.total) + '"></div>' +
            "<b>" + (m.total ? fmtINR(m.total).replace("₹", "") : "0") + "</b><span>" + m.label + "</span></div>").join("") +
        "</div></div>" +
        '<div class="card"><h3>Loan Book by Category</h3><p class="muted">Sanctioned loans across the network.</p>' +
        loansByType.map(l =>
            '<div style="margin-bottom:12px"><div class="card-flex"><span>' + esc(l.type) + "</span><b>" + l.n + " loans</b></div>" +
            '<div style="background:#232838;border-radius:8px;height:10px;overflow:hidden"><div style="height:100%;width:' + Math.max(3, l.n * 10) + '%;background:linear-gradient(90deg,var(--blue),var(--pink));border-radius:8px"></div></div></div>').join("") +
        "</div></div>" +

        '<div class="grid-2">' +
        '<div class="card"><h3>Account Mix</h3><p class="muted">Share of each account type.</p>' +
        mix.map(m => '<div style="margin-bottom:10px" class="card-flex"><span>' + esc(m.t) + '</span><b>' + m.n + " (" + m.pct + "%)</b></div>").join("") +
        "</div>" +
        '<div class="card"><h3>Top Customers by Balance</h3><p class="muted">Wealth leaders in the system.</p>' +
        '<table><thead><tr><th>Customer</th><th>ID</th><th>Total Balance</th></tr></thead><tbody>' +
        topCust.map(r => "<tr><td>" + avatar(r.c.name) + "<b>" + esc(r.c.name) + "</b></td><td class='muted'>" + esc(r.c.custNo) + "</td><td style='color:#6ea1ff;font-weight:700'>" + fmtINR(r.bal) + "</td></tr>").join("") +
        "</tbody></table></div></div>" +

        '<div class="card"><h3>Network Snapshot</h3><div class="kv-grid">' +
        '<div class="kv"><span>Total Deposits</span><b>' + fmtINR(totBal) + "</b></div>" +
        '<div class="kv"><span>Avg. Account Balance</span><b>' + fmtINR(DB.accounts.length ? totBal / DB.accounts.length : 0) + "</b></div>" +
        '<div class="kv"><span>Branches</span><b>' + DB.branches.filter(b => b.active).length + " active / " + DB.branches.length + " total</b></div>" +
        '<div class="kv"><span>Staff</span><b>' + DB.employees.filter(e => e.active).length + " active</b></div>" +
        '<div class="kv"><span>Customers per Branch</span><b>' + (DB.customers.length / DB.branches.length).toFixed(1) + "</b></div>" +
        '<div class="kv"><span>KYC Completed</span><b>' + DB.customers.filter(c => c.kyced).length + "/" + DB.customers.length + "</b></div>" +
        '<div class="kv"><span>Failed Transactions</span><b>' + DB.transactions.filter(t => t.status === "Failed").length + "</b></div>" +
        '<div class="kv"><span>Payroll / Month</span><b>' + fmtINR(DB.employees.reduce((s, e) => s + e.salary, 0)) + "</b></div>" +
        "</div></div></div>";
}

/* =====================================================================
   GLOBAL SEARCH
   ===================================================================== */
function globalSearch(q) {
    q = q.toLowerCase();
    if (q.length < 2) return;
    const found = [];
    DB.customers.filter(c => (c.name + c.custNo + c.phone + c.email).toLowerCase().includes(q)).slice(0, 5).forEach(c => found.push({ type: "Customer", id: c.id, sub: c.custNo + " · " + c.phone, name: c.name }));
    DB.branches.filter(b => (b.name + b.ifsc + b.city).toLowerCase().includes(q)).slice(0, 5).forEach(b => found.push({ type: "Branch", id: b.id, sub: b.ifsc + " · " + b.city, name: b.name }));
    DB.employees.filter(e => (e.name + e.empNo + e.designation).toLowerCase().includes(q)).slice(0, 5).forEach(e => found.push({ type: "Employee", id: e.id, sub: e.empNo + " · " + e.designation, name: e.name }));
    DB.loans.filter(l => (l.loanNo + l.type).toLowerCase().includes(q) && custName(l.custId).toLowerCase().includes(q)).slice(0, 5).forEach(l => found.push({ type: "Loan", id: l.id, sub: l.loanNo + " · " + l.type, name: custName(l.custId) }));

    if (!found.length) return toast("No matches for “" + q + "”", "err");
    modal("Search Results (" + found.length + ")",
        found.map(f =>
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;background:var(--black-3)">' +
            '<div>' + avatar(f.name) + "<b>" + esc(f.name) + "</b><br><span class='muted'>" + f.type + " · " + esc(f.sub) + "</span></div>" +
            '<button class="btn btn-sm btn-ghost" data-goto="' + f.type.toLowerCase() + '">Open</button></div>').join("") +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>');
}

/* ---------------- EVENT WIRING ---------------- */
document.addEventListener("DOMContentLoaded", () => {

    loadDB();

    /* password toggle */
    document.querySelectorAll("[data-pwd-toggle]").forEach(btn => {
        btn.onclick = () => {
            const inp = $(btn.dataset.pwdToggle);
            inp.type = inp.type === "password" ? "text" : "password";
        };
    });

    /* LOGIN */
    $("login-form").onsubmit = (e) => {
        e.preventDefault();
        const email = $("login-email").value.trim().toLowerCase();
        const pass = $("login-password").value;
        const user = DB.users.find(u => u.email.toLowerCase() === email && u.password === pass);
        if (!user) return toast("Invalid credentials. Try admin@prismbank.in / Prism@123", "err");

        /* 2-step: OTP verification */
        currentOtp = genOtp();
        startOtpTimer($("otp-timer-text"));
        $("demo-otp").textContent = currentOtp;
        const phone = user.phone.replace(/[+\d ]/g, "");
        $("otp-mask").textContent = "••••" + phone.slice(-4);
        $("step-login").classList.add("hidden");
        $("step-otp").classList.remove("hidden");
        wireOtpInputs();
        document.querySelector("#step-otp .otp-box") && document.querySelector("#step-otp .otp-box").focus();
        session = user;
    };

    $("otp-verify").onclick = () => {
        const val = Array.from(document.querySelectorAll("#step-otp .otp-box")).map(b => b.value).join("");
        if (val === currentOtp) {
            clearInterval(otpTimer);
            toast("Welcome back, " + session.name + " ✓", "ok");
            showApp();
        } else toast("Incorrect OTP. Check the demo code shown above.", "err");
    };

    $("otp-back").onclick = () => {
        clearInterval(otpTimer);
        $("step-otp").classList.add("hidden");
        $("step-login").classList.remove("hidden");
        session = null;
    };

    $("btn-logout").onclick = () => {
        session = null;
        currentOtp = "";
        clearInterval(otpTimer);
        $("step-otp").classList.add("hidden");
        $("step-login").classList.remove("hidden");
        $("login-password").value = "";
        showLogin();
        toast("Logged out safely. See you soon 👋");
    };

    /* NAV */
    document.querySelectorAll(".side-link").forEach(btn => {
        btn.onclick = () => showView(btn.dataset.view);
    });

    /* GLOBAL SEARCH */
    let debounce = null;
    $("global-search").oninput = (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => globalSearch(e.target.value.trim()), 350);
    };
    document.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => {
        closeModal();
        showView(b.dataset.goto);
    });

    /* MODAL CLOSE */
    $("modal-close").onclick = closeModal;
    $("modal-overlay").addEventListener("mousedown", (e) => { if (e.target === $("modal-overlay")) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    /* AUTO-OPEN — no login / OTP verification required */
    session = { email: "admin@prismbank.in", name: "System Administrator", role: "Admin", phone: "+91 98765 43210" };
    showApp();
});
