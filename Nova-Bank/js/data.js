/* =====================================================================
   PRISMBANK — seed database (randomly generated for demo purposes only)
   Tables: branches, employees, customers, accounts, transactions, loans
   ===================================================================== */

/* Seeded PRNG so the "random" database is stable across refreshes */
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

var RNG = mulberry32(20260707);
var rand = function (min, max) { return Math.floor(RNG() * (max - min + 1)) + min; };
var pick = function (arr) { return arr[Math.floor(RNG() * arr.length)]; };
var chance = function (p) { return RNG() < p; };

var FIRST = ["Aarav","Vivaan","Aditya","Diya","Sara","Mohammed","Kabir","Ananya","Ishaan","Riya","Arjun","Myra","Sahil","Priya","Rohan","Neha","Vikram","Sneha","Devansh","Kavya","Aryan","Tara","Zoya","Arnav","Nisha","Rahul","Pooja","Sameer","Isha","Karan","Nidhi","Harsh","Ritu"];
var LAST = ["Sharma","Verma","Patel","Reddy","Mehta","Iyer","Nair","Gupta","Singh","Khan","Desai","Thakur","Joshi","Chopra","Malhotra","Kulkarni","Banerjee","Shetty","Agarwal","Bhat"];

var CITIES = ["Mumbai","Pune","Bengaluru","Hyderabad","Chennai","Kolkata","Ahmedabad","Jaipur","Lucknow","Nagpur","Surat","Indore"];
var LOCALITIES = ["MG Road","Civil Lines","Sector 14","Andheri West","Koramangala","Banjara Hills","Anna Nagar","Salt Lake","HBR Layout","Sadar Bazaar"];
var EMAIL_TAGS = ["gmail.com","outlook.com","yahoo.com","prismmail.com"];

var DEPARTMENTS = ["Operations","Accounts","Information Technology","Compliance","Human Resources","Risk Management","Customer Service"];
var DESIGNATIONS = [
    "Teller","Cash Officer","Branch Coordinator","Accountant","Ledger Officer","Tax Analyst",
    "System Admin","Network Engineer","Data Analyst","Developer","Compliance Officer","Auditor",
    "Risk Analyst","HR Executive","Recruiter","Training Lead","Customer Care","Support Lead",
    "Relationship Manager","Loan Processing Officer","Credit Analyst"
];

var LOAN_TYPES = ["Home Loan","Personal Loan","Car Loan","Education Loan","Business Loan","Gold Loan"];
var LOAN_STATUS = ["Active","Pending","Rejected","Closed"];
var TXN_TYPES = ["Deposit","Withdrawal","Transfer","UPI Pay","Interest","Card Payment"];
var ACC_TYPES = ["Savings","Current","Fixed Deposit","Salary"];

var BRANCH_SEED = [
    { name: "Meridian Corporate", city: "Mumbai" },
    { name: "Fergusson Road", city: "Pune" },
    { name: "Indiranagar Twin", city: "Bengaluru" },
    { name: "Hitech Medina", city: "Hyderabad" },
    { name: "Anna Nagar West", city: "Chennai" },
    { name: "Park Street", city: "Kolkata" },
    { name: "Ashram Road", city: "Ahmedabad" },
    { name: "Malviya Nagar", city: "Jaipur" },
    { name: "Janakpuri East", city: "Delhi" },
    { name: "Nandanvan Plaza", city: "Nagpur" }
];

var daysAgo = function (n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
};

function pad(n, l) { return String(n).padStart(l, "0"); }

/* ==================== BRANCHES ==================== */
var Branches = BRANCH_SEED.map(function (b, i) {
    return {
        id: i + 1,
        brCode: "PR" + (1001 + i),
        name: "Prism Bank — " + b.name,
        ifsc: "PRMB0" + pad(100 + i, 4),
        micr: "400" + rand(100, 999) + "0" + i,
        city: b.city,
        address: "Plot " + rand(1, 99) + ", " + pick(LOCALITIES) + ", " + b.city,
        phone: "+91 " + rand(90000, 99999) + " " + rand(10000, 99999),
        swRate: (rand(300, 600) / 100).toFixed(2),
        fdRate: (rand(600, 825) / 100).toFixed(2),
        opened: 2004 + rand(0, 20),
        staff: 0,
        active: i % 4 !== 0
    };
});

/* ==================== EMPLOYEES ==================== */
var Employees = [];
(function seedEmployees() {
    var usedNames = {};
    for (var i = 0; i < 26; i++) {
        var name;
        do { name = pick(FIRST) + " " + pick(LAST); } while (usedNames[name]);
        usedNames[name] = true;
        var branch = Branches[rand(0, Branches.length - 1)];
        var dept = pick(DEPARTMENTS);
        var isManager = i < Branches.length * 0.8;
        var designation = i < Branches.length * 0.8 ? "Branch Manager" : pick(DESIGNATIONS);
        var email = name.toLowerCase().replace(/ /g, ".") + "@prismbank.in";
        Employees.push({
            id: i + 1,
            empNo: "PRM-E" + pad(2001 + i, 4),
            name: name,
            designation: designation,
            department: isManager ? "Branch Management" : dept,
            email: email,
            phone: "+91 " + rand(70000, 99999) + " " + rand(10000, 99999),
            branchId: branch.id,
            salary: rand(28000, 145000),
            joined: daysAgo(rand(60, 2900)),
            manager: isManager,
            active: chance(0.92)
        });
    }
})();

/* ==================== CUSTOMERS ==================== */
var Customers = [];
(function seedCustomers() {
    var used = {};
    for (var i = 0; i < 40; i++) {
        var name;
        do { name = pick(FIRST) + " " + pick(LAST); } while (used[name]);
        used[name] = true;
        var city = pick(CITIES);
        var branch = Branches[rand(0, Branches.length - 1)];
        var phone = "+91 " + rand(60000, 99999) + " " + rand(10000, 99999);
        var email = name.toLowerCase().replace(/ /g, ".") + rand(10, 99) + "@" + pick(EMAIL_TAGS);
        Customers.push({
            id: i + 1,
            custNo: "PRM-C" + pad(5001 + i, 4),
            name: name,
            email: email,
            phone: phone,
            city: city,
            address: "H.No " + rand(1, 999) + ", " + pick(LOCALITIES) + ", " + city,
            dob: daysAgo(rand(7500, 23000)),
            aadhaar: String(rand(100000000000, 999999999999)),
            branchId: branch.id,
            balance: rand(1200, 450000),
            kyced: chance(0.85),
            opened: daysAgo(rand(10, 1200)),
            status: chance(0.06) ? "Dormant" : "Active"
        });
    }
})();

/* ==================== ACCOUNTS ==================== */
var Accounts = [];
(function seedAccounts() {
    for (var i = 0; i < Customers.length; i++) {
        var c = Customers[i];
        var n = c.status === "Active" ? (chance(0.4) ? 2 : 1) : 1;
        for (var j = 0; j < n; j++) {
            var type = pick(ACC_TYPES);
            var balance = type === "Fixed Deposit"
                ? rand(50000, 1200000)
                : type === "Current" ? rand(10000, 600000) : rand(500, 300000);
            Accounts.push({
                id: Accounts.length + 1,
                acctNo: String(rand(10000000000, 99999999999)),
                custId: c.id,
                type: type,
                branchId: c.branchId,
                balance: balance,
                opened: c.opened,
                status: c.status === "Dormant" ? "Frozen" : "Active"
            });
        }
    }
})();

/* ==================== TRANSACTIONS ==================== */
var Transactions = [];
(function seedTransactions() {
    var desc = {
        "Deposit": ["Cash deposit at counter", "Cheque cleared", "RTGS inward", "NEFT inward"],
        "Withdrawal": ["ATM withdrawal", "Counter withdrawal", "Cheque encashed"],
        "Transfer": ["NEFT transfer", "RTGS transfer", "IMPS transfer"],
        "UPI Pay": ["UPI pay to shop", "UPI bill payment", "UPI grocery payment"],
        "Interest": ["Savings interest credit", "FD interest credit"],
        "Card Payment": ["POS card swipe", "Online card payment", "Subscription payment"]
    };
    var n = 120;
    for (var i = 0; i < n; i++) {
        var acct = Accounts[rand(0, Accounts.length - 1)];
        var type = pick(TXN_TYPES);
        var amount = rand(200, 25000) + Math.round(RNG() * 99) / 100;
        var credit = type === "Deposit" || type === "Interest" || type === "Transfer" && chance(0.5);
        Transactions.push({
            id: i + 1,
            refNo: "PRMTXN" + pad(900001 + i, 6),
            acctNo: acct.acctNo,
            custId: acct.custId,
            date: daysAgo(rand(0, 180)),
            type: type,
            desc: pick(desc[type]),
            amount: amount,
            credit: credit,
            status: chance(0.9) ? "Success" : "Failed",
            balanceAfter: Math.round((acct.balance + (credit ? amount : -amount)) * 100) / 100
        });
    }
})();

/* ==================== LOANS ==================== */
var Loans = [];
(function seedLoans() {
    var usedCust = {};
    var rates = { "Home Loan": 8.5, "Personal Loan": 12.9, "Car Loan": 9.3, "Education Loan": 10.6, "Business Loan": 13.5, "Gold Loan": 7.9 };
    for (var i = 0; i < 16; i++) {
        var c;
        do { c = pick(Customers); } while (usedCust[c.id]);
        usedCust[c.id] = true;
        var type = pick(LOAN_TYPES);
        var status = pick(LOAN_STATUS);
        var amount = type === "Home Loan" ? rand(15, 80) * 100000
            : type === "Business Loan" ? rand(5, 40) * 100000
            : type === "Car Loan" ? rand(3, 15) * 100000
            : type === "Gold Loan" ? rand(1, 8) * 100000
            : rand(50, 900) * 1000;
        var tenure = rand(12, 240);
        var rate = rates[type] + (RNG() * 1.2).toFixed(2);
        var r = rate / 100 / 12;
        var emi = (amount * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
        Loans.push({
            id: i + 1,
            loanNo: "PRM-L" + pad(7001 + i, 4),
            custId: c.id,
            type: type,
            amount: amount,
            tenure: tenure,
            rate: Math.round(rate * 100) / 100,
            emi: Math.round(emi),
            status: status,
            applied: daysAgo(rand(5, 400)),
            purpose: pick(["Purchase of property", "Wedding expenses", "Car purchase", "Higher education", "Working capital", "Medical emergency", "Home renovation"])
        });
    }
})();

/* ==================== APP USERS ==================== */
var Users = [
    { email: "admin@prismbank.in", password: "Prism@123", name: "System Administrator", role: "Admin", phone: "+91 98765 43210" }
];

/* ==================== HELPERS / LOOKUPS ==================== */
function getCustomer(id) {
    for (var i = 0; i < Customers.length; i++) if (Customers[i].id === id) return Customers[i];
    return null;
}
function getBranch(id) {
    for (var i = 0; i < Branches.length; i++) if (Branches[i].id === id) return Branches[i];
    return null;
}
function getAccountByNo(no) {
    for (var i = 0; i < Accounts.length; i++) if (Accounts[i].acctNo === no) return Accounts[i];
    return null;
}
function custAccounts(custId) {
    return Accounts.filter(function (a) { return a.custId === custId; });
}
function fmtINR(n) {
    return "\u20B9" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}
function branchName(id) { var b = getBranch(id); return b ? b.name : "—"; }
function custName(id) { var c = getCustomer(id); return c ? c.name : "—"; }
