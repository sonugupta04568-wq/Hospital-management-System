/* =========================================================
   MediFast — AI Prediction Engine + App Logic (demo)
   ========================================================= */
'use strict';

/* ---------- Small helpers ---------- */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);

/* ---------- Hospital network (defined early so state can use it) ---------- */
const FACILITIES = ['Emergency 24x7', 'ICU', 'Pharmacy', 'Laboratory', 'Ambulance 24x7', 'MRI / CT Scan',
    'Blood Bank', 'Maternity', 'Pediatrics', 'Operation Theatre', 'Radiology', 'Dialysis',
    'Cardiology', 'Orthopedics', 'Dental', 'OPD', 'Mental Health', 'Physiotherapy'];

const DEFAULT_HOSPITALS = [
    { id: 'h1', name: 'MediFast Main Campus', address: '12, Health Avenue, MG Road, Indore, MP - 452001', phone: '+91 98765 43210', beds: 200, facilities: ['Emergency 24x7', 'ICU', 'Pharmacy', 'Laboratory', 'Ambulance 24x7', 'Blood Bank', 'Radiology', 'Operation Theatre'] },
    { id: 'h2', name: 'MediFast City Branch', address: '45, Green Park, Vijay Nagar, Indore, MP - 452010', phone: '+91 91234 56780', beds: 120, facilities: ['Emergency 24x7', 'ICU', 'Pharmacy', 'Maternity', 'Pediatrics', 'Dialysis'] },
    { id: 'h3', name: 'MediFast North Wing', address: '8, Ring Road, Bhopal, MP - 462001', phone: '+91 9120 000 000', beds: 80, facilities: ['OPD', 'Laboratory', 'Radiology', 'Dental', 'Orthopedics', 'Physiotherapy'] },
];

function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- AUTH (login / signup) — localStorage demo accounts ---------- */
const AUTH_USERS_KEY = 'medifast_users';
const AUTH_SESSION_KEY = 'medifast_session';
function loadUsers() { try { return JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || []; } catch (e) { return []; } }
function saveUsers(u) { localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(u)); }
function currentUser() { try { const s = localStorage.getItem(AUTH_SESSION_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function setSession(u) { if (u) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(u)); else localStorage.removeItem(AUTH_SESSION_KEY); }

function seedAuth() {
    const users = loadUsers();
    if (!users.find(u => u.email === 'admin@medifast.in')) {
        users.push({ name: 'Demo Admin', email: 'admin@medifast.in', phone: '+91 90000 00000', role: 'Hospital Admin', pass: 'admin123', joined: new Date().toISOString().slice(0, 10) });
        saveUsers(users);
    }
}

function roleIcon(role) {
    if (role === 'Doctor') return '🩺';
    if (role === 'Hospital Admin') return '🏥';
    if (role === 'Blood Donor') return '🩸';
    return '👤';
}

function renderAuthUI() {
    const u = currentUser();
    const btn = $('#auth-btn');
    const chip = $('#user-chip');
    if (!btn || !chip) return;
    if (u) {
        btn.style.display = 'none';
        chip.style.display = 'flex';
        $('#user-avatar').textContent = roleIcon(u.role);
        $('#user-name').textContent = u.name + ' · ' + u.role;
    } else {
        btn.style.display = '';
        chip.style.display = 'none';
    }
}

function openAuth(tab) {
    $('#auth-overlay').classList.add('open');
    switchAuthTab(tab || 'login');
}
function closeAuth() { $('#auth-overlay').classList.remove('open'); }

function switchAuthTab(tab) {
    $$('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('#login-form').style.display = tab === 'login' ? '' : 'none';
    $('#signup-form').style.display = tab === 'signup' ? '' : 'none';
}

function submitLogin(e) {
    e.preventDefault();
    const email = $('#login-email').value.trim().toLowerCase();
    const pass = $('#login-pass').value;
    const u = loadUsers().find(x => x.email === email && x.pass === pass);
    if (!u) { toast('❌ Invalid email or password'); return; }
    setSession({ name: u.name, email: u.email, phone: u.phone, role: u.role });
    closeAuth();
    renderAuthUI();
    $('#login-form').reset();
    toast('Welcome back, ' + u.name + ' 👋');
}

function submitSignup(e) {
    e.preventDefault();
    const name = $('#su-name').value.trim();
    const email = $('#su-email').value.trim().toLowerCase();
    const phone = $('#su-phone').value.trim();
    const role = $('#su-role').value;
    const pass = $('#su-pass').value;
    if (!name || !email || !pass) { toast('Fill all required fields'); return; }
    if (pass.length < 6) { toast('Password must be at least 6 characters'); return; }
    const users = loadUsers();
    if (users.find(x => x.email === email)) { toast('⚠️ Account already exists — please login'); return; }
    const u = { name, email, phone, role, pass, joined: new Date().toISOString().slice(0, 10) };
    users.push(u);
    saveUsers(users);
    setSession({ name: u.name, email: u.email, phone: u.phone, role: u.role });
    closeAuth();
    renderAuthUI();
    $('#signup-form').reset();
    toast('Account created — welcome, ' + name + ' 🎉');
}

function logout() {
    setSession(null);
    renderAuthUI();
    toast('Logged out. See you soon 👋');
}

/* ---------- MEDIBOT (automated ask & reply) ---------- */
let chatMsgId = 0;
function nowTime() {
    const d = new Date();
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes()) + ' ' + ap;
}
function setChatStatus(mode) {
    const st = $('#chat-status');
    if (!st) return;
    st.innerHTML = mode === 'typing' ? '<i class="stat-dot typing-dot"></i> typing…' : '<i class="stat-dot"></i> online';
}
/* Person-like memory: bot remembers topics and asks about them later */
function rememberTopic(label) {
    state.lastTopic = label;
    state.topicAsked = false;
}

/* ---------- TALKING MODES (personas): professional, doctor, friendly, senior ---------- */
const PERSONAS = {
    professional: {
        name: 'MediCare Pro',
        avatar: '🤝',
        greet: 'Namaste! 🙏 Main MediCare Pro hoon — aapka professional healthcare assistant.\nHealth, hospital, blood, emergency — formal, clear aur accurate guidance milegi.\n🚨 Emergency ho to "Emergency Assistant" chip dabayein.',
        close: '\n\n— MediCare Pro 🙏'
    },
    doctor: {
        name: 'Dr. Medi',
        avatar: '🧑‍⚕️',
        greet: 'Namaskar! 🙏 Main Dr. Medi hoon. Aapko professional medical guidance aur hospital services me madad karunga.\nKripya dhyaan dein: main AI hoon — doctor ka replacement nahi. 🚨 Emergency me "Emergency Assistant" chip dabayein.',
        close: '\n\n— Dr. Medi 🙏 (AI · doctor ka replacement nahi)'
    },
    friend: {
        name: 'MediRescue AI',
        avatar: '🧑‍⚕️',
        greet: 'Namaste! 🙏 Main MediRescue AI hoon.\nMain calmly sunta hoon, turant samajhta hoon, aur emergency care se connect karne me madad karta hoon.\n🚨 Emergency ho to "Emergency Assistant" chip dabayein.',
        close: ''
    },
    senior: {
        name: 'Medi Sahayak',
        avatar: '👵',
        greet: 'Namaste ji! 🙏 Main Medi Sahayak hoon. Main dheere-dheere, aaram se baat karta hoon. Koi jaldi nahi hai — aap jo poochhna chahein, poochhiye. Main aapki har baat dhyan se sununga. 🚨 Emergency ho to "Emergency Assistant" chip dabayein.',
        close: ''
    }
};
const PERSONA_KEY = 'medifast_persona';
function loadPersona() { try { return localStorage.getItem(PERSONA_KEY) || 'professional'; } catch (e) { return 'professional'; } }
function persona() { return PERSONAS[state.persona] || PERSONAS.professional; }
function applyPersona() {
    const p = persona();
    const av = $('#chat-avatar'); if (av) av.textContent = p.avatar;
    const nm = $('#chat-name'); if (nm) nm.textContent = p.name;
    const sel = $('#chat-persona'); if (sel) sel.value = state.persona;
}
function setPersona(key) {
    state.persona = PERSONAS[key] ? key : 'professional';
    try { localStorage.setItem(PERSONA_KEY, state.persona); } catch (e) {}
    applyPersona();
    toast('Mode: ' + persona().name + ' ' + persona().avatar);
}
function openChat() {
    $('#chat-panel').classList.add('open');
    $('#chat-input').focus();
    if (!state.chatGreeted) {
        state.chatGreeted = true;
        $('#chat-msgs').innerHTML = '';
        chatBot(persona().greet);
    }
    clearTimeout(state._nudgeT);
    state._nudgeT = setTimeout(() => {
        if (!state.chatNudged && $('#chat-panel').classList.contains('open')) {
            state.chatNudged = true;
            const n = ['Arre, itni der se koi baat nahi ki? 😄 Main yahin hoon — health, mood, ya kuch bhi, bolo!', 'Hmm, aap chup ho gaye? 🤔 Kya chal raha hai? Koi sawal ho to poochho — main kabhi bore nahi hota!', 'Koi pareshaani nahi, bas reminder: main 24x7 yahin hoon. 😊 Neend, khana, paani… kuch bhi discuss karo!'];
            chatBot(n[Math.floor(Math.random() * n.length)]);
        }
    }, 60000);
}
function closeChat() { $('#chat-panel').classList.remove('open'); }

/* WhatsApp-style rows: avatar + name + time, ticks on user messages */
function chatAdd(text, who) {
    const row = document.createElement('div');
    row.className = 'chat-row ' + who;
    if (who === 'bot') {
        row.innerHTML = '<span class="c-avatar">🧑‍⚕️</span><div class="c-body"><div class="chat-msg bot">' + esc(text) + '</div><div class="c-meta">MediRescue AI · ' + nowTime() + '</div></div>';
    } else {
        const u = currentUser();
        const init = u && u.name ? u.name.trim()[0].toUpperCase() : 'Y';
        const id = 'tk' + (++chatMsgId);
        row.innerHTML = '<div class="c-body"><div class="chat-msg user">' + esc(text) + '</div><div class="c-meta right"><span class="ticks" id="' + id + '">✓</span> ' + nowTime() + '</div></div><span class="c-avatar c-av-user">' + esc(init) + '</span>';
        setTimeout(() => { const t = document.getElementById(id); if (t) t.textContent = '✓✓'; }, 1000);
    }
    $('#chat-msgs').appendChild(row);
    $('#chat-msgs').scrollTop = $('#chat-msgs').scrollHeight;
    return row;
}

function chatTyping() {
    const row = document.createElement('div');
    row.className = 'chat-row bot';
    row.innerHTML = '<span class="c-avatar">🧑‍⚕️</span><div class="c-body"><div class="chat-msg bot typing"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span></div><div class="c-meta">MediRescue AI · typing…</div></div>';
    $('#chat-msgs').appendChild(row);
    $('#chat-msgs').scrollTop = $('#chat-msgs').scrollHeight;
    return row;
}

function chatBot(text) {
    state._botBusy = true;
    setChatStatus('typing');
    const typing = chatTyping();
    const slow = state.persona === 'senior' ? 1.7 : 1;
    const d = Math.min(1100, 420 + text.length * 2.2) * slow + Math.random() * 350;
    setTimeout(() => {
        typing.remove();
        const suff = persona().close;
        chatAdd(suff ? text + suff : text, 'bot');
        speakChat(text);
        state._botBusy = false;
        setChatStatus('online');
    }, d);
}

function chatTypeReply(q) { chatBotChunks(botReply(q)); }

/* Split a reply into small human-size message chunks (browser-safe, no lookbehind) */
function splitReply(text) {
    const parts = [];
    text.split(/\n+/).forEach(seg => {
        const t = seg.trim();
        if (!t) return;
        if (t.length <= 110) { parts.push(t); return; }
        const chunks = t.match(/[^.!?…]+[.!?…]*\s*/g) || [t];
        let cur = '';
        chunks.forEach(sub => {
            const cand = cur ? cur + ' ' + sub : sub;
            if (cand.length <= 110) cur = cand;
            else { if (cur) parts.push(cur.trim()); cur = sub; }
        });
        if (cur.trim()) parts.push(cur.trim());
    });
    return parts;
}

/* Types a reply chunk-by-chunk — each chunk shows its own typing bubble (like a person) */
function chatBotChunks(text) {
    const chunks = splitReply(text);
    let i = 0;
    state._botBusy = true;
    const slow = state.persona === 'senior' ? 1.7 : 1;
    const next = () => {
        if (i >= chunks.length) { state._botBusy = false; setChatStatus('online'); speakChat(text); return; }
        const typing = chatTyping();
        setTimeout(() => {
            typing.remove();
            const suff = i === chunks.length - 1 ? persona().close : '';
            chatAdd(suff ? chunks[i] + suff : chunks[i], 'bot');
            i++;
            next();
        }, (420 + Math.random() * 500) * slow);
    };
    setChatStatus('typing');
    next();
}

/* ---------- LIVE VOICE in chat: mic se bolo, AI reply kare (bolkar bhi) ---------- */
let chatRec = null;
let chatListening = false;
function speakChat(text) {
    if (!state.chatVoice || !window.speechSynthesis) return;
    const clean = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = state.chatLang === 'hi' ? 'hi-IN' : 'en-IN';
    u.rate = 1.02;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
}
function toggleChatVoice() {
    state.chatVoice = !state.chatVoice;
    const b = $('#chat-voice-toggle');
    if (state.chatVoice) { b.textContent = '🔊'; b.classList.add('on'); toast('Voice replies ON — AI ab bolega 🔊'); }
    else { b.textContent = '🔇'; b.classList.remove('on'); toast('Voice replies OFF 🔇'); }
}
function startChatVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Voice recognition not supported. Try Chrome/Edge.'); return; }
    if (chatListening) { chatRec.stop(); return; }
    chatRec = new SR();
    chatRec.lang = 'hi-IN';
    chatRec.interimResults = false;
    chatRec.maxAlternatives = 1;
    chatListening = true;
    const mic = $('#chat-mic');
    mic.classList.add('listening');
    $('#chat-status').innerHTML = '<i class="stat-dot typing-dot"></i> 🎙️ sun raha hoon…';
    chatRec.onresult = (e) => {
        const text = e.results[0][0].transcript.trim();
        if (!text) return;
        $('#chat-input').value = text;
        sendChat();
    };
    chatRec.onerror = (e) => {
        if (e.error === 'not-allowed') toast('Mic permission denied — allow karo 🙏');
    };
    chatRec.onend = () => {
        chatListening = false;
        mic.classList.remove('listening');
        if (!state._botBusy) setChatStatus('online');
    };
    try { chatRec.start(); } catch (err) { chatListening = false; mic.classList.remove('listening'); }
}

function pick(en, hi, q) { return /[\u0900-\u097F]/.test(q) ? hi : en; }

const SYM_CARE = {
    headache: ['Halka headache: aaram karein, thoda paani lein, dark & quiet room me 15-20 min. Paracetamol sirf doctor ki salah se lein.', 'Mild headache: rest, water, 15-20 min in a dark quiet room. Paracetamol only on doctor\u2019s advice.'],
    fever: ['Halka bukhar: fluids zyada lein, aaram karein, body cool rakhein. 102F+ ya 3 din se zyada ho to doctor se milein.', 'Mild fever: fluids, rest, keep body cool. See a doctor if 102F+ or more than 3 days.'],
    cough: ['Khansi: garam paani, steam, shahed-adrak wali chai. 2 hafte se zyada ho to doctor se milein.', 'Cough: warm water, steam, honey-ginger tea. See a doctor if it lasts over 2 weeks.'],
    cold: ['Jukaam: garam paani, aaram, light food. 7 din se zyada ya tez bukhar ho to doctor se milein.', 'Cold: warm fluids, rest, light food. See a doctor if over 7 days or high fever.'],
    stomach: ['Pet dard: light food, khub paani, heavy/oily khana avoid karein. Tez ya lagatar dard ho to turant doctor.', 'Stomach pain: light food, plenty of water, avoid oily food. Severe or continuous pain needs immediate care.'],
    body: ['Kamzori/thakan: aaram, paani, balanced khana, halki activity. 3+ din lagatar ho to doctor se milein.', 'Weakness/fatigue: rest, water, balanced diet, light activity. See a doctor if 3+ days.'],
    generic: ['Kisi bhi dard me pehle: aaram + paani. Tez ho ya badh raha ho to turant medical help lein.', 'For any pain: first rest + water. If severe or worsening, seek medical help immediately.']
};
const SYM_KEYS = [
    { k: 'headache', w: ['headache', 'sir dard', 'सिर दर्द', 'सिरदर्द', 'सर दर्द'] },
    { k: 'fever', w: ['fever', 'bukhar', 'बुखार'] },
    { k: 'cough', w: ['cough', 'khansi', 'khoonsi', 'खांसी'] },
    { k: 'cold', w: ['cold', 'jukaam', 'जुकाम'] },
    { k: 'stomach', w: ['pet dard', 'पेट दर्द', 'stomach', 'पेट खराब'] },
    { k: 'body', w: ['body pain', 'badan dard', 'बदन दर्द', 'kamzori', 'कमजोरी', 'thakan', 'थकान', 'thak gaya', 'थक गया', 'थका', 'weak', 'weakness'] }
];
const SYM_NAME = { headache: 'sir ka dard', fever: 'bukhar', cough: 'khansi', cold: 'jukaam', stomach: 'pet dard', body: 'kamzori/thakan', generic: 'yeh dard' };
const DEPT_MAP = [
    { label: 'Cardiology (heart)', kws: ['cardio', 'heart', 'दिल', 'हृदय'] },
    { label: 'Neurology (brain)', kws: ['neuro', 'brain', 'stroke', 'लकवा', 'दिमाग'] },
    { label: 'Trauma/Emergency', kws: ['trauma', 'accident', 'chot', 'चोट', 'emergency'] },
    { label: 'Orthopedics (bone)', kws: ['ortho', 'bone', 'हड्डी'] },
    { label: 'Pediatrics (child)', kws: ['pediatr', 'child', 'baby', 'बच्चा', 'शिशु'] },
    { label: 'Maternity', kws: ['matern', 'delivery', 'labor', 'प्रसव', 'गर्भ'] },
    { label: 'Kidney/Dialysis', kws: ['kidney', 'dialysis', 'किडनी'] },
    { label: 'General', kws: ['general', 'bimar', 'बीमार', 'ill'] }
];

function botReply(q) {
    const s = q.toLowerCase();
    const has = (...w) => w.some(x => s.includes(x));
    const pool = a => a[Math.floor(Math.random() * a.length)];
    const who = currentUser();
    const nm = who ? who.name.split(' ')[0] : 'friend';
    let reply = null;

    /* ---- 0. symptom severity follow-up (2-turn conversation) ---- */
    if (state.sym && (has('severe', 'heavy', 'bahut', 'बहुत', 'zyada', 'ज्यादा', 'gambhir', 'गंभीर', 'bohot', 'high', 'tez', 'तेज़') || has('halka', 'हल्का', 'thoda', 'थोड़ा', 'thodi', 'थोड़ी', 'light', 'mild'))) {
        const severe = has('severe', 'heavy', 'bahut', 'बहुत', 'zyada', 'ज्यादा', 'gambhir', 'गंभीर', 'bohot', 'high', 'tez', 'तेज़');
        const sk = state.sym.sym;
        state.sym = null;
        if (severe) {
            return L('Yeh serious ho sakta hai. 🙏 Kripya turant medical help lein — 🚨 "Emergency Assistant" chip dabayein ya +91 98765 43210 / 112 par call karein. Main aapko ambulance, hospital aur blood se connect kar dunga. (📌 Main AI hoon — doctor ka replacement nahi, par safety ke liye turant action zaroori.)',
                'This can be serious. 🙏 Please seek medical help immediately — tap the 🚨 "Emergency Assistant" chip or call +91 98765 43210 / 112. I will connect you to ambulance, hospital and blood support. (📌 I am an AI, not a doctor — but immediate action matters.)',
                'Yeh serious ho sakta hai. Kripya turant medical help lein — Emergency Assistant chip dabayein ya +91 98765 43210 / 112 par call karein. Main ambulance + hospital + blood connect kar dunga.');
        }
        return L('Achha, halka hai to chain ki baat hai. 😊 ' + SYM_CARE[sk][1] + '\n📌 Disclaimer: main AI hoon — doctor ka replacement nahi. Kabhi lagta hai ki badh raha hai to turant batayein.',
            'Good, mild is reassuring. 😊 ' + SYM_CARE[sk][1] + '\n📌 I am an AI, not a doctor. If it worsens, tell me immediately.',
            'Achha, halka hai to chain ki baat hai. ' + SYM_CARE[sk][1] + ' Disclaimer: main AI hoon, doctor nahi. Badhe to turant batayein.');
    }
    if (state.sym) state.sym = null;

    /* ---- 1. Emergency AI Mode 🚨 ---- */
    const isEmergency = /(chest|छाती|सीने)|(breath|saans lene|सांस लेने|साँस लेने)|(bleeding|heavy bleed|खून बह)|(accident|दुर्घटना|हादसा|hadasa)|(behosh|बेहोश|unconscious)|(fracture|फ्रैक्चर)|(heart attack|dil ka daura|दिल का दौरा)|(stroke|लकवा)|(bahut dard|severe pain|heavy pain|बहुत दर्द|गंभीर दर्द)|(chot|चोट|injury)/.test(s);
    if (isEmergency) {
        return L('🚨 Yeh emergency ho sakti hai. Kripya turant emergency services (112 / 108) se contact karein. Main aapko next steps aur nearest suitable help dhoondhne me guide kar sakta hoon — 🚨 "Emergency Assistant" chip dabayein, main ek-ek karke zaroori sawal poochunga aur ambulance + hospital + blood se turant connect karunga. Shaant rahiye, main aapke saath hoon. 🙏',
            '🚨 This could be an emergency. Please contact emergency services (112 / 108) immediately. I can guide you through next steps and find the nearest suitable help — tap the 🚨 "Emergency Assistant" chip and I will ask essential questions one by one and connect you to ambulance, hospital and blood support. Stay calm, I am with you. 🙏',
            '🚨 Yeh emergency ho sakti hai. Kripya turant 112/108 par contact karein. Main next steps + nearest help guide kar sakta hoon — Emergency Assistant chip dabayein, main ambulance + hospital + blood connect karunga. Shaant rahiye, main aapke saath hoon.');
    }

    /* ---- 2. how are you / feeling ---- */
    if (has('kaise ho', 'kaise hain', 'how are you', 'kaisa feel', 'feel kar', 'कैसे हो', 'कैसे हैं', 'कैसा')) {
        reply = pool([
            'Main ekdum mast, aapki seva me! 😄 Aur aap batao — aaj kaisa feel kar rahe hain? Koi thakan, headache ya chinta ho to batao, main sunne ke liye yahin hoon. 🧘',
            'Main bilkul theek! 😊 Aap kaisa feel kar rahe hain? Health, mood ya kuch bhi — khul ke bolo, main judge nahi karta.',
        ]);
    }

    /* ---- 3. greeting ---- */
    else if (/\b(hello|hi|hey|namaste|hola)\b/.test(s) || s.includes('नमस्ते') || s.includes('नमस्कार') || s.includes('good morning') || s.includes('good evening')) {
        reply = pool([
            'Hello ' + nm + '! 😊 Main ' + persona().name + ' hoon. Aap kaise hain? Main aapki health, hospital services aur emergency support se related help kar sakta hoon — beds, blood, ambulance, sab!',
            'Namaste ' + nm + '! 🙏 ' + persona().name + ' bol raha hoon. Kaisa chal raha hai? Health, hospital ya emergency — kuch bhi poochho, main yahin hoon.',
            'Hey ' + nm + '! 👋 Main ' + persona().name + ' — calm, caring aur fast! 😄 Aapki kya madad kar sakta hoon?',
        ]);
    }

    /* ---- 4. mental comfort ---- */
    else if (has('akela', 'अकेला', 'alone', 'lonely', 'udaas', 'उदास', 'sad', 'depress', 'अवसाद', 'bore', 'बोर')) {
        reply = L('Aap akela feel nahi kar rahe — main yahin hoon, sunne ke liye. ❤️ Bataiye kya baat hai. Dil bhaari ho raha ho to kisi apne se baat karna ya counselor se baat karna bhi bahut achha step hai. Aapka khayal rakhna important hai.',
            'You are not alone — I am here to listen. ❤️ Tell me what\u2019s on your mind. If things feel heavy, talking to a loved one or a counselor is a strong, brave step. Take care of yourself.',
            'Aap akela feel nahi kar rahe — main yahin hoon. ❤️ Bataiye kya baat hai. Dil bhaari ho to kisi apne se baat karna bhi achha step hai.');
    }

    /* ---- 5. stress & relaxation ---- */
    else if (has('stress', 'tension', 'pareshan', 'परेशान', 'चिंता', 'chinta', 'anxiety', 'anks', 'तनाव')) {
        rememberTopic('stress');
        reply = pool([
            'Main samajh sakta hoon. 😊 Aap aaram se bata sakte hain ki kis wajah se stress feel ho raha hai. Main calmly aapki baat sununga aur possible next steps suggest karunga. Ek tip: 4-7-8 breathing — 4 sec saans lo, 7 sec rok, 8 sec chhodo. 🧘',
            'Stress me aap akela nahi ho — main yahin hoon. 🌿 Chinta ki wajah batao to main sun sakta hoon. Abhi ke liye: deep breathing 5 baar, thoda paani, thodi walk — phir baat karte hain.',
        ]);
    }

    /* ---- 6. sleep talk ---- */
    else if (has('sleep', 'neend', 'नींद', 'so rahe', 'sone', 'निद्रा', 'insomnia')) {
        rememberTopic('neend');
        reply = pool([
            'Neend ki baat karte hain. 😴 7–8 ghante ideal hai. Phone 1 ghanta pehle band, dark room, same time par sona — yeh teen asaan tips. Roj 6 ghante se kam neend health par bhaari padti hai. Aapki neend kaisi chal rahi hai?',
            'Sleep important hai! 😴 Kya aapko neend aane me dikkat hoti hai? Thodi si night routine banao: chai/coffee shaam 4 ke baad band, screen kam, halki light — neend apne aap sudhar jayegi.',
        ]);
    }

    /* ---- 7. food & nutrition ---- */
    else if (has('khana', 'खाना', 'khaya', 'bhook', 'भूख', 'diet', 'meal', 'eating')) {
        rememberTopic('khana');
        reply = pool([
            'Aaj khana khaya? 😄 Thoda sa bhi — fruits, sabzi, daal — kaafi hai. Samay par khana aur paani, dono mile toh half health set! 🥗',
            'Khana miss kiya? 😟 Dhyan rakhiye — 3 samay ka light + balanced khana aur beech me fruits/nuts. Aapka body aapka support chaahta hai!',
        ]);
    }

    /* ---- 8. water reminder ---- */
    else if (has('paani', 'पानी', 'pani', 'water', 'hydrate', 'प्यास', 'pyaas')) {
        rememberTopic('paani');
        reply = pool([
            '💧 Paani reminder! Roj 7–8 glasses target hai. Ek tip: har ghante 1 glass — mobile par alarm laga lo. Aapka body aapka shukriya kahega!',
            'Hydration = energy! 💧 Thakaan lagti hai to pehle ek glass paani try karo — 70% chances theek lagta hai. Din bhar me 7–8 glasses pakka.',
        ]);
    }

    /* ---- 9. exercise & walking ---- */
    else if (has('exercise', 'walk', 'walking', 'टहल', 'yoga', 'योग', 'workout', 'कसरत', 'kasrat')) {
        rememberTopic('exercise/walk');
        reply = pool([
            '🚶 Din me sirf 15–20 min ki walk bhi kamaal kar sakti hai. Morning me halki walk + thoda stretch — heart, mood, neend sab improve. Aaj se shuru karein?',
            'Exercise ki baat achhi hai! 💪 Naya hai to 10 min se start karo, dheere-dheere badhao. Consistency > intensity. Aur haan — walk karte waqt paani sath me!',
        ]);
    }

    /* ---- 10. medicine reminder ---- */
    else if (has('dawai', 'दवा', 'medicine', 'गोली', 'goli', 'dose', 'tablet')) {
        rememberTopic('dawa');
        reply = pool([
            '💊 Dawa ka rule: doctor ne jo schedule diya hai, usse respect karein — same time par, bina miss kiye. Dawa khud band na karein, pehle doctor se baat karein. Koi side-effect ho to turant doctor ko batayein.',
            'Medicine reminder set? ⏰ Aaj ki dawa ho gayi? Schedule follow karna bahut important hai — aur kabhi bhi apne aap dose badhayein na ghatayein. Doctor se milke hi decide karein.',
        ]);
    }

    /* ---- 11. daily routine ---- */
    else if (has('routine', 'दिनचर्या', 'din kaise', 'daily', 'roz kya')) {
        reply = pool([
            'Mera routine: 24x7 aapki seva! 😄 Aapke baare me batao — sleep, khana, paani, exercise — kisi ek ke baare me poochho, main guidance dunga. Chaho to 🧬 "Lifestyle Profile" chip se poora profile bana sakte hain.',
            'Routine ki baat karte hain! 😊 Ek healthy din: 7–8 ghante neend, samay par khana, 7–8 glasses paani, 15 min walk. Inme se kya miss ho raha hai — batao, saath me theek karte hain.',
        ]);
    }

    /* ---- 12. senior citizen care ---- */
    else if (has('dadaji', 'दादाजी', 'dada ji', 'dadi', 'दादी', 'buzurg', 'बुज़ुर्ग', 'elder', 'senior', 'amma', 'अम्मा', 'chacha', 'चाचा', 'fufa', 'nani', 'नानी', 'nana', 'नाना')) {
        rememberTopic('buzurgon ka khayal');
        reply = pool([
            'Aap buzurgon ka khayal rakhte hain — yeh bahut badi baat hai! 🙏 Unhe roz ki choti walks, dawa time par, aur regular BP/checkup me madad karein. Girne se bachane ke liye ghar me achhi lighting + railings. Koi specific problem ho to batao, main bilkul patient hoon aur poori tarah sununga.',
            'Buzurgon ki dekhbhal me respect + patience sabse zaroori hai. 🤝 Unki dawa ka record rakhein, khana samay par, aur kisi bhi naye symptom par doctor se zaroor milein. Kya hua hai — batao, main guide karunga.',
        ]);
    }

    /* ---- 13. child care guidance ---- */
    else if (!has('hospital', 'kahan', 'कहाँ') && has('bachcha', 'बच्चा', 'bachchi', 'बच्ची', 'baby', 'child', 'kid', 'शिशु', 'baccha', 'bacche', 'बच्चे')) {
        rememberTopic('bachchon ki dekhbhal');
        reply = pool([
            'Bachchon ki dekhbhal me patience hi asli dawa hai! 😊 Fever ho to fluids + aaram, 102F+ ya rash/breathing issue ho to turant doctor. Chhote bachche me dehydration se bachayein — thoda-thoda karke paani/ORAL. 📌 Main AI hoon, doctor ki jagah nahi. Kisi bhi emergency me 🚨 chip dabayein.',
            'Parent-friendly advice: 👶 Bachche ko bukhar me halka kapda, fluids zyada, aaram. Tez bukhar (102F+), kam paani, ya suste rahna ho to doctor se milein. Doubt ho to poochho — main yahin hoon. 🚨 Emergency me chip dabayein.',
        ]);
    }

    /* ---- 14. worried family / fear (calm personality) ---- */
    else if ((/(papa|mummy|maa|mom|dad|dada|dadi|bhai|behen|bhabhi|beta|बेटा|बेटी)/.test(s) && /(dard|दर्द|pain|bimar|बीमार|problem|परेशान|tension|बुखार|fever|बेहोश|behosh|unconscious|खून|bleed|दुर्घटना|accident|बीमारी)/.test(s)) || /(डर|darr|darta)/.test(s)) {
        reply = pool([
            'Main aapke saath hoon. 🧘 Aap calmly bataiye kya ho raha hai — main pehle poori situation samajhta hoon, phir clear next steps bataunga. Agar emergency jaisa kuch ho to 🚨 "Emergency Assistant" chip dabayein. (📌 Main AI hoon, doctor nahi.)',
            'Main samajh sakta hoon. ❤️ Kripya aaram se batayein — kya hua hai? Main sun raha hoon. Zaroorat ho to main ambulance/hospital/blood me turant connect kar sakta hoon — 🚨 chip dabayein.',
        ]);
    }

    /* ---- 15. basic symptom conversation (severity check) ---- */
    else {
        const symHit = SYM_KEYS.find(x => x.w.some(w => s.includes(w)));
        if (symHit || has('pain', 'dard', 'दर्द', 'bimar', 'बीमार', 'ill')) {
            const sk = symHit ? symHit.k : 'generic';
            state.sym = { sym: sk };
            rememberTopic(SYM_NAME[sk]);
            reply = pool([
                'Mujhe afsos hai ki aap theek feel nahi kar rahe. 🥺 ' + SYM_NAME[sk] + ' — halka hai ya bahut severe? Aur kab se ho raha hai? Abhi ke liye: ' + SYM_CARE[sk][0] + '\n📌 Main AI hoon — doctor ka replacement nahi.',
                'Main samajh sakta hoon. 🙏 ' + SYM_NAME[sk] + ' kitna severe hai — thoda ya bahut? Kab se hai? Bas ' + SYM_CARE[sk][0] + ' (📌 AI guidance hai, doctor ki jagah nahi.)',
            ]);
        }

        /* ---- 16. appointment ---- */
        else if (has('appointment', 'doctor', 'book', 'डॉक्टर', 'अपॉइंटमेंट')) {
            reply = pool([
                'Appointment? Bilkul! 🩺 Upar hospital select karke Hospitals tab me booking kar sakte ho. Doctors Mon–Sat, subah 9–5 baje milte hain.',
                'Ji haan! OPD booking ke liye Hospitals tab dekho. Main baaki sab me bhi madad kar sakta hoon. 😊',
            ]);
        }

        /* ---- 17. health tips ---- */
        else if (has('tip', 'tips', 'suggestion', 'सुझाव', 'sehat', 'स्वास्थ्य', 'healthy')) {
            const TIPS = ['Roz 7–8 ghante neend 😴', 'Din me 15–20 min walk 🚶', '7–8 glasses paani 💧', 'Fruits + sabzi daily 🥗', 'Screen se 1 ghanta pehle phone band 📵', 'Regular BP / checkup 📋'];
            reply = 'Health tip (aaj ki): ' + pool(TIPS) + ' 🎯 Bonus: thoda sa smile bhi dawa hai! 😄 Koi topic chuno — neend, khana, paani, exercise — main detail me bataunga.';
        }

        /* ---- 18. smart hospital finder ---- */
        else {
            const dept = DEPT_MAP.find(d => d.kws.some(k => s.includes(k)));
            if (dept && has('hospital', 'hospitals', 'kahan', 'कहाँ', 'nearest', 'नजदीक', 'near', 'chahiye', 'चाहिए', 'चाहिये', 'find', 'dhoondo', 'ढूंढ', 'dikh', 'दिखा', 'problem', 'issue', 'doctor', 'डॉक्टर', 'jagah', 'जगह')) {
                const kw = dept.kws[0].toLowerCase();
                const hits = [];
                HOSPITAL_NETWORK.forEach(h => { if ((h.spec || []).some(sp => sp.toLowerCase().includes(kw))) hits.push({ n: h.name, c: h.city, s: (h.spec || []).join(', '), icu: h.icu, gen: h.general, load: h.load }); });
                state.hospitals.forEach(h => { if ((h.facilities || []).some(f => f.toLowerCase().includes(kw))) hits.push({ n: h.name, c: '', s: (h.facilities || []).join(', '), icu: 0, gen: h.beds, load: 0 }); });
                const seen = {};
                const top = hits.filter(x => !seen[x.n] && (seen[x.n] = 1)).slice(0, 3);
                if (!top.length) HOSPITAL_NETWORK.filter(h => (h.spec || []).some(sp => /general|icu|trauma/i.test(sp))).slice(0, 3).forEach(h => top.push({ n: h.name, c: h.city, s: (h.spec || []).join(', '), icu: h.icu, gen: h.general, load: h.load }));
                reply = 'Nearest ' + dept.label + ' hospitals (Delhi-NCR):\n' + top.map(h => '🏥 ' + h.n + (h.c ? ' (' + h.c + ')' : '') + '\n  ' + h.s + (h.icu ? ' · ICU ' + h.icu + ' | General ' + h.gen : ' · ' + h.gen + ' beds') + (h.load ? ' · load ' + h.load + '%' : '')).join('\n') + '\n📌 Hospitals tab me full detail — emergency me 🚨 chip dabayein.';
            }

            /* ---- 19. blood bank finder (group-wise) ---- */
            else {
                const gmm = s.match(/\b(ab|a|b|o)\s*(positive|negative|\+|-)/);
                if (gmm) {
                    const group = gmm[1].toUpperCase() + (gmm[2] === 'positive' ? '+' : gmm[2] === 'negative' ? '-' : gmm[2]);
                    const rows = state.bloodStock.filter(r => r.blood_group === group);
                    const total = rows.reduce((t, r) => t + r.units_available, 0);
                    const banks = rows.map(r => { const b = state.blood.find(x => x.blood_bank_id === r.blood_bank_id); return { n: b ? b.name : r.blood_bank_id, c: b ? b.city : '', u: r.units_available }; }).filter(x => x.u > 0).sort((x, y) => y.u - x.u).slice(0, 3);
                    reply = '🩸 ' + group + ': kul ' + total + ' units ' + state.blood.length + ' banks me available.\n' + (banks.length ? banks.map(b => '· ' + b.n + ' (' + b.c + ') — ' + b.u + ' units').join('\n') : 'Abhi kisi bank me stock nahi mila.') + (total <= 2 ? '\n⚠️ Bahut kam stock — Blood Bank tab me Emergency Blood Request bhej dein.' : '') + '\n📌 Full detail Blood Bank tab me.';
                }

                /* ---- 20. emergency check / safe & help ---- */
                else if (has('safe hoon', 'surakshit hoon', 'मैं सुरक्षित', 'safe hu', 'emergency check', 'help chahiye', 'madad chahiye', 'मदद चाहिए', 'immediate help', 'turant help', 'emergency', 'आपातकाल', 'helpline', '112', '108')) {
                    reply = pool([
                        'Kya aap safe hain? 🙏 Kya immediate help chahiye? Agar haan — turant call karein +91 98765 43210 (112/108 bhi) aur 🚨 "Emergency Assistant" chip dabayein. Main ambulance + hospital + blood — sab me connect karunga. Main yahin hoon.',
                        'Emergency check: sab theek hai? 👍 Agar kuch chahiye — ambulance, blood, hospital — to 🚨 chip dabayein ya call karein +91 98765 43210. Koi bhi waqt, main yahin hoon!',
                    ]);
                }

                /* ---- 21. ambulance assistance ---- */
                else if (has('ambulance', 'एम्बुलेंस')) {
                    reply = pool([
                        '🚑 Ambulance chahiye? Apna location batao (city ya GPS coordinates) — main nearest suitable ambulance + hospital select karunga, ETA aur live tracking bataunga (Ambulance tab me). 🚨 "Emergency Assistant" chip se guided flow me case ID + hospital alert bhi milta hai. Helpline: +91 98765 43210.',
                        'Relax, main sambhal leta hoon! 🚑 Apna location do (city ya GPS) — main dispatch kar raha hoon + live track + ETA Ambulance tab me. Emergency me 🚨 chip se poora assisted flow. Call: +91 98765 43210.',
                    ]);
                }

                /* ---- 22. beds ---- */
                else if (has('bed', 'occupancy', 'free', 'khali', 'बेड', 'बिस्तर')) {
                    const occTotal = Object.keys(state.occupied).reduce((t, k) => t + (state.occupied[k] || 0), 0);
                    const depts = DEPARTMENTS.map(d => d.name + ': ' + Math.round(clamp((state.occupied[d.id] / d.beds) * 100, 0, 100)) + '%').slice(0, 5).join(' · ');
                    reply = pool([
                        'Chaliye check karta hoon… abhi total ' + occTotal + ' beds occupied hain. ' + depts + '… Koi specific ward poochhna ho toh batao. 👍',
                        'Abhi ' + occTotal + ' beds full hain. Detail me dekhein: ' + depts + '. Aur kuch?',
                    ]);
                }

                /* ---- 23. blood stock (generic) ---- */
                else if (has('blood', 'रक्त', 'खून')) {
                    const totalUnits = state.bloodStock.reduce((t, r) => t + r.units_available, 0);
                    const lowGroups = BLOOD_GROUPS.filter(g => state.bloodStock.filter(r => r.blood_group === g).reduce((t, r) => t + r.units_available, 0) <= 3);
                    const lowStr = lowGroups.length ? ' Bas thodi si tension: ' + lowGroups.join(', ') + ' kam hain.' : ' Sab groups theek hain, koi tension nahi.';
                    reply = pool([
                        'Ek second, stock khol raha hoon… 🩸 Kul ' + totalUnits + ' units ' + state.blood.length + ' blood banks me available hain.' + lowStr + ' Group-wise detail Blood Bank tab me mil jayega.',
                        'Blood stock abhi: ' + totalUnits + ' units kul, ' + state.blood.length + ' banks me.' + lowStr + ' Kisi group ki zaroorat ho to batao, main turant check kar dunga!',
                    ]);
                }

                /* ---- 24. visiting hours ---- */
                else if (has('visit', 'hour', 'timing', 'time', 'समय', 'विजिटिंग')) {
                    reply = pool([
                        'Visiting hours: subah 10–1 baje aur shaam 4–7 baje. ⏰ ICU/emergency me ek time par sirf 1 visitor allowed. Kuch aur batao?',
                        'Timing yeh hai: 10:00–13:00 aur 16:00–19:00. Shukriya poochhne ke liye! 😊',
                    ]);
                }

                /* ---- 25. prediction ---- */
                else if (has('predict', 'overcrowd', 'crowd', 'rush', 'waiting', 'load', 'भीड़', 'प्रेडिक्शन')) {
                    const occTotal = Object.keys(state.occupied).reduce((t, k) => t + (state.occupied[k] || 0), 0);
                    const lvl = occTotal > 200 ? 'High' : occTotal > 120 ? 'Moderate' : 'Low';
                    const hl = lvl === 'High' ? 'zyada bheed' : lvl === 'Moderate' ? 'medium bheed' : 'kam bheed';
                    reply = pool([
                        'AI bol raha hai abhi ' + hl + ' hogi (' + occTotal + ' beds occupied). 😌 Shaam ko thoda rush badh jaata hai — AI Predictions tab me graph dekho.',
                        'Mera prediction: ' + hl + '. Waise shaam 6–9 baje waiting time sabse zyada hota hai. 👀',
                    ]);
                }

                /* ---- 26. routing ---- */
                else if (has('route', 'navigate', 'floor', 'map', 'रास्ता', 'रूट')) {
                    reply = pool([
                        'Rasta? Main dikha deta hoon! 🗺️ Smart Routing tab kholo aur department chuno — 3D map par fastest floor-to-floor route dikh jayega.',
                        'Smart Routing 3D map par sabse fast raasta dikhata hai (Radiology, OT, ICU…). Tab khol ke dekho, pakka pasand aayega! 😄',
                    ]);
                }

                /* ---- 27. hospital network ---- */
                else if (has('hospital', 'list', 'network', 'हॉस्पिटल')) {
                    reply = pool([
                        'MediFast network me ' + state.hospitals.length + ' registered + ' + HOSPITAL_NETWORK.length + ' dispatch hospitals hain poore Delhi-NCR me. 🏥 Hospitals tab me poora list hai.',
                        'Total network: ' + (state.hospitals.length + HOSPITAL_NETWORK.length) + ' hospitals! Sab Delhi-NCR me. Chaaho toh kisi ek ke baare me bata do, main detail dunga.',
                    ]);
                }

                /* ---- 28. donor ---- */
                else if (has('donor', 'donate', 'दान')) {
                    reply = pool([
                        'Wah, dil saaf hai aapka! 🩸❤️ Blood Bank tab me donor register kar do — aapke jaisa donor kisi ki jaan bacha sakta hai!',
                        'Donor banoge? Zabardast! 🩸 Blood Bank tab me register karo, main emergency match kar dunga.',
                    ]);
                }

                /* ---- 29. who are you ---- */
                else if (has('who are you', 'your name', 'kaun ho', 'कौन हो')) {
                    reply = pool([
                        'Main ' + persona().name + ' hoon — aapka 24/7 healthcare & emergency navigation assistant. 🧘 Calm · ❤️ Caring · ⚡ Fast · 💬 Clear · 🤝 Respectful. Baat karo, health guidance lo, sahi care find karo — emergency me help tak jaldi pahuncho! (📌 AI doctor ka replacement nahi hai.)',
                        persona().name + '! 😊 Aapka apna health + emergency helper — beds, blood, ambulance, hospital finder, lifestyle, sab. Normal baat bhi karo — main dosti bhi karta hoon!',
                    ]);
                }

                /* ---- 30. help ---- */
                else if (has('help', 'madad', 'सहायता', 'kar sakte')) {
                    reply = pool([
                        'Main yeh sab kar sakta hoon: 🩺 symptoms · 🛏️ beds · 🩸 blood (group-wise bhi!) · 🚑 ambulance · 🏥 hospital finder (heart, brain, bone…) · 🕐 timing · 📈 prediction · 🗺️ routing · 🩸 donor · 🧬 lifestyle. Normal baat bhi karo — kaise ho, neend, khana, paani! Quick chips neeche hain. 😊',
                        'Suno: symptoms, beds, blood, ambulance, hospital finder, timing, prediction, routing, donor, lifestyle… kuch bhi poochho! 😎 Emergency me 🚨 chip dabao.',
                    ]);
                }

                /* ---- 31. thanks ---- */
                else if (has('thank', 'dhanyawad', 'shukriya', 'धन्यवाद', 'शुक्रिया')) {
                    reply = pool([
                        'Koi baat nahi! 🙏 Aapka din shubh ho. Aur kuch?',
                        'Koi tension nahi! 😊 Happy to help. Aur kuch madad?',
                    ]);
                }

                /* ---- 32. bye ---- */
                else if (has('bye', 'goodbye', 'alvida', 'अलविदा', 'good night')) {
                    reply = pool([
                        'Alvida ' + nm + '! 💙 Khayal rakhna, swasth raho. Phir milte hain!',
                        'Bye bye! 👋 Jab bhi zaroorat ho, main yahin hoon. Take care!',
                    ]);
                }

                /* ---- 33. love / good bot ---- */
                else if (has('love you', 'pyar', 'good bot', 'best bot')) {
                    reply = pool([
                        'Aww, dhanyawad! 🥹❤️ Aap bhi bahut achhe!',
                        'Ye sunke bahut achha laga! 🥰 Aapka din sahi rahe!',
                    ]);
                }

                /* ---- 34. general conversation ---- */
                else if (has('weather', 'mausam', 'मौसम', 'movie', 'film', 'cricket', 'hobby', 'hobbies', 'work', 'study', 'पढ़ाई', 'job', 'game', 'song', 'music', 'क्रिकेट', 'chutti', 'holiday', 'मूवी')) {
                    reply = pool([
                        'Achha topic! 😄 Main health me expert hoon, par aapki baat sunna hamesha achha lagta hai. Health ka khayal rakhiye — thoda walk + paani + acchi neend, aur baaki sab set!',
                        'Haan ji, batao! 😄 Waise din me 10 min ki walk aur khana samay par — yeh dono cheezein aapka mood bhi badha dengi. Kisi aur cheez me madad?',
                    ]);
                }

                /* ---- 35. generic problem ---- */
                else if (has('problem', 'dikkat', 'समस्या', 'mushkil', 'मुश्किल')) {
                    reply = pool([
                        'Batayein kya problem ho rahi hai? 🙏 Main poori tarah sun raha hoon — health, hospital, blood, ambulance, ya normal baat — kisi bhi cheez me madad kar sakta hoon. Quick chips bhi neeche hain.',
                        'Koi baat nahi, bataiye kya ho raha hai — main yahin hoon. 🧘 Agar emergency me ho to 🚨 "Emergency Assistant" chip dabayein, warna normal baat karte hain.',
                    ]);
                }

                /* ---- 36. fallback ---- */
                else {
                    reply = pool([
                        'Hmm, samajhne ki koshish kar raha hoon… 🤔 Main MediRescue AI hoon — symptoms, beds, blood (group-wise), ambulance, hospital finder, timing, prediction, routing, donor, lifestyle… sab me expert. Neeche quick chips se shuru karein?',
                        'Sorry, thoda aur batao na. 😅 Jaise: "O+ blood kahan milenga", "nearest heart hospital", "mujhe headache hai" ya bas "hello". Main yahin hoon!',
                    ]);
                }
            }
        }
    }
    /* person-like follow-up: refer to earlier topic on greetings / check-ins */
    if (reply && state.lastTopic && !state.topicAsked && (has('kaise ho', 'how are you', 'कैसे हो') || /\b(hello|hi|hey|namaste)\b/.test(s))) {
        state.topicAsked = true;
        reply += '\n\nWaise, pehle aapne ' + state.lastTopic + ' ki baat ki thi — ab kaisa chal raha hai? 😊';
    }
    return reply;
}

function sendChat() {
    try {
        const inp = $('#chat-input');
        const q = inp.value.trim();
        if (!q) return;
        chatAdd(q, 'user');
        inp.value = '';
        if (state.rescue.active && !state.rescue.done) { rescueAnswer(q); return; }
        if (state.lifestyle.active && !state.lifestyle.done) { lifestyleAnswer(q); return; }
        chatTypeReply(q);
    } catch (err) {
        chatBot('Hmm, kuch gadbad ho gayi… 😅 Ek baar aur try karein? Main yahin hoon.');
    }
}

/* =========================================================
   MEDIRESCUE AI — guided emergency assistant + lifestyle
   (human-like: calm, respectful, one question at a time)
   ========================================================= */
const RESCUE_TYPES = {
    'Accident':          { type: 'Accident',         spec: 'Trauma',     icon: '💥' },
    'Breathing Problem': { type: 'BreathingProblem', spec: 'ICU',        icon: '🫁' },
    'Chest Pain':        { type: 'HeartAttack',      spec: 'Cardiology', icon: '❤️' },
    'Bleeding':          { type: 'Accident',         spec: 'Trauma',     icon: '🩸' },
    'Stroke':            { type: 'Stroke',           spec: 'Neurology',  icon: '🧠' },
    'Fever':             { type: 'Fever',            spec: 'General',    icon: '🤒' },
    'Other':             { type: 'Accident',         spec: 'Trauma',     icon: '⚠️' },
};

function L(hi, en, hg) {
    if (state.chatLang === 'hi') return hi;
    if (state.chatLang === 'en') return en;
    return hg || hi;
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const DEFAULT_CHIPS_HTML = [
    '<button class="chip" data-action="rescue">🚨 Emergency Assistant</button>',
    '<button class="chip" data-action="lifestyle">🧬 Lifestyle Profile</button>',
    '<button class="chip" data-q="Kitne beds free hain?">🛏️ Beds</button>',
    '<button class="chip" data-q="Blood stock kaisa hai?">🩸 Blood</button>',
    '<button class="chip" data-q="Aaj overcrowding kaisa hoga?">📈 Prediction</button>',
].join('');

function showChips(list) {
    $('#chat-chips').innerHTML = (list && list.length)
        ? list.map(c => `<button class="chip" data-v="${esc(c)}">${c}</button>`).join('')
        : DEFAULT_CHIPS_HTML;
}
function restoreChips() { $('#chat-chips').innerHTML = DEFAULT_CHIPS_HTML; }

/* ---- Rescue flow ---- */
const RESCUE_STEPS = [
    { key: 'greet', q: () => L('नमस्ते, मैं MediRescue AI हूँ। 😊 मैं आपकी मदद के लिए यहाँ हूँ। क्या आपको emergency सहायता चाहिए?', 'Hello, I am MediRescue AI. 😊 I am here to help you. Do you need emergency assistance?', 'Namaste, main MediRescue AI hoon. Kya aapko emergency sahayata chahiye?'), opts: ['हाँ / Yes', 'नहीं / No'] },
    { key: 'lang', q: () => L('किस भाषा में बात करें? (Hindi / English / Hinglish)', 'Which language? (Hindi / English / Hinglish)', 'Kis bhasha me baat karein? (Hindi / English / Hinglish)'), opts: ['Hindi', 'English', 'Hinglish'] },
    { key: 'name', q: () => L('Patient का नाम क्या है? 🙏', 'What is the patient\u2019s name? 🙏', 'Patient ka naam kya hai?') },
    { key: 'age', q: () => L('Patient की उम्र कितनी है? (सालों में)', 'How old is the patient? (in years)', 'Patient ki umar kitni hai?') },
    { key: 'type', q: () => L('Emergency type क्या है? नीचे से चुनें।', 'What is the emergency type? Choose below.', 'Emergency type kya hai? Neeche se chunein.'), opts: ['Accident', 'Breathing Problem', 'Chest Pain', 'Bleeding', 'Stroke', 'Fever', 'Other'] },
    { key: 'conscious', q: () => L('Patient conscious है या नहीं?', 'Is the patient conscious?', 'Patient conscious hai ya nahi?'), opts: ['हाँ / Yes', 'नहीं / No'] },
    { key: 'breathing', q: () => L('क्या patient सांस ले रहा है?', 'Is the patient breathing?', 'Kya patient saans le raha hai?'), opts: ['हाँ / Yes', 'नहीं / No'] },
    { key: 'bleeding', q: () => L('क्या गंभीर bleeding हो रही है?', 'Is there severe bleeding?', 'Kya gambhir bleeding ho rahi hai?'), opts: ['हाँ / Yes', 'नहीं / No'] },
    { key: 'location', q: () => L('आपकी current location confirm करें — city नीचे से चुनें या नाम लिखें।', 'Confirm your current location — choose a city below or type the name.', 'Aapki current location confirm karein — city neeche se chunein ya naam likhein.'), opts: ['New Delhi', 'Noida', 'Ghaziabad', 'Gurugram', 'Faridabad'] },
    { key: 'contact', q: () => L('Emergency contact number दें।', 'Please give an emergency contact number.', 'Emergency contact number dein.') },
    { key: 'medical', q: () => L('Known allergies / important conditions? अगर कोई नहीं तो "कोई नहीं" लिखें।', 'Any known allergies / important conditions? Type "none" if none.', 'Known allergies / important conditions? Koi nahi to "koi nahi" likhein.') },
    { key: 'support', q: () => L('Required support क्या है? (Ambulance / Blood / Hospital)', 'What support is needed? (Ambulance / Blood / Hospital)', 'Required support kya hai? (Ambulance / Blood / Hospital)'), opts: ['Ambulance', 'Blood', 'Hospital', 'Ambulance + Blood'] },
    { key: 'priority', q: d => L('मेरा assessment: ' + d.priority + ' priority। ⚠️ क्या confirm है?', 'My assessment: ' + d.priority + ' priority. ⚠️ Confirm?', 'Mera assessment: ' + d.priority + ' priority. Confirm karein?'), opts: ['हाँ / Yes', 'नहीं / No'] },
    { key: 'summary', q: d => L('Summary confirm करें ⤵️\n' + rescueSummary(d) + '\nसब ठीक है?', 'Please confirm the summary ⤵️\n' + rescueSummary(d) + '\nAll correct?', 'Summary confirm karein ⤵️\n' + rescueSummary(d) + '\nSab theek hai?'), opts: ['हाँ / Yes', 'नहीं / No'] },
];

function supportLabel(d) {
    const s = d.support || {};
    return [s.ambulance ? 'Ambulance' : '', s.blood ? 'Blood' : '', s.hospital ? 'Hospital' : ''].filter(Boolean).join(' + ') || 'Ambulance';
}
function rescueSummary(d) {
    const t = RESCUE_TYPES[d.type] || {};
    return (d.name || '-') + ' · ' + (d.age || '-') + ' yrs · ' + (t.icon || '') + ' ' + (d.type || '-')
        + '\nConscious: ' + (d.conscious ? 'Yes' : 'No') + ' · Breathing: ' + (d.breathing ? 'Yes' : 'No')
        + ' · Bleeding: ' + (d.bleeding ? 'Yes' : 'No')
        + '\n📍 ' + (d.location || '-') + ' · 📞 ' + (d.contact || '-')
        + '\nMedical: ' + (d.medical || '-') + ' · Support: ' + supportLabel(d)
        + '\nPriority: ' + (d.priority || '-');
}
function computePriority() {
    const d = state.rescue.data;
    if (!d.conscious || !d.breathing || d.bleeding || d.type === 'Chest Pain' || d.type === 'Breathing Problem') return 'Critical';
    if (d.type === 'Stroke' || d.type === 'Accident' || (d.age && (d.age > 65 || d.age < 5))) return 'High';
    return d.type === 'Fever' ? 'Low' : 'Medium';
}
function safetyText(type) {
    switch (type) {
        case 'Chest Pain': return L('· Patient ko baithayein / aaram dein\n· Tight kapde dheele karein\n· Pehle di gayi dawa ho to dein\n· Bina zaroorat na hilayein', '· Keep patient seated/resting\n· Loosen tight clothing\n· Give prescribed medicine if available\n· Do not move unnecessarily', '· Patient ko baithayein / aaram dein · Tight kapde dheele karein · Pehle di gayi dawa ho to dein · Bina zaroorat na hilayein');
        case 'Breathing Problem': return L('· Patient ko baithakar aage jhukayein\n· Taza hawa dein, khidki kholein\n· Dawa/inhaler ho to dein\n· Ghabrayein nahin', '· Sit patient leaning forward\n· Fresh air, open a window\n· Give inhaler/medication if available\n· Stay calm', '· Patient ko baithakar aage jhukayein · Taza hawa dein · Dawa/inhaler ho to dein · Ghabrayein nahin');
        case 'Stroke': return L('· Patient ko litayein, sir thoda upar\n· Kuch khane/peene ko na dein\n· Lakshan shuru hone ka samay note karein', '· Lay patient down, head slightly raised\n· No food or drink\n· Note the time symptoms started', '· Patient ko litayein, sir thoda upar · Kuch khane/peene ko na dein · Lakshan shuru hone ka samay note karein');
        case 'Accident':
        case 'Bleeding': return L('· Saaf kapde se bleeding par dabav dein\n· Patient ko na hilayein jab tak zaroori na ho\n· Kuch khane/peene ko na dein', '· Apply pressure on bleeding with clean cloth\n· Do not move unless necessary\n· No food or drink', '· Saaf kapde se bleeding par dabav dein · Patient ko na hilayein · Kuch khane/peene ko na dein');
        default: return L('· Shaant rahein aur patient ko aashvast karein\n· Emergency care pahunchne tak saath rahein', '· Stay calm and reassure the patient\n· Stay until emergency care arrives', '· Shaant rahein aur patient ko aashvast karein · Emergency care tak saath rahein');
    }
}

function startRescue() {
    state.rescue = { active: true, step: 0, lang: state.chatLang === 'auto' ? 'hi' : state.chatLang, caseId: null, done: false, data: {}, priorityConfirmed: false, summaryConfirmed: false };
    botSayStep();
}
function endRescue() {
    state.rescue = { active: false, step: 0, lang: 'hi', caseId: null, done: false, data: {} };
    restoreChips();
}
function botSayStep() {
    const r = state.rescue;
    const st = RESCUE_STEPS[r.step];
    if (st.key === 'priority' && !r.data.priority) r.data.priority = computePriority();
    chatBot(st.q(r.data));
    showChips(st.opts || []);
}
function rescueAnswer(ans) {
    const r = state.rescue;
    const step = RESCUE_STEPS[r.step];
    const a = ans.trim();
    const yes = /हाँ|^yes|^ha\b|^h\b/i.test(a);
    const no = /नहीं|^no|^na\b/i.test(a);
    let ok = true;
    switch (step.key) {
        case 'greet':
            if (no) {
                chatBot(L('कोई बात नहीं, मैं यहाँ हूँ। 😊 किसी और चीज़ में मदद चाहिए?', 'No problem, I am here. 😊 Anything else I can help with?', 'Koi baat nahi, main yahin hoon. Kisi aur cheez me madad?'));
                endRescue(); return;
            }
            r.data.confirm = true;
            break;
        case 'lang': {
            const l = a.toLowerCase();
            r.lang = l.includes('hind') ? 'hi' : l.includes('hing') ? 'hinglish' : 'en';
            state.chatLang = r.lang;
            chatBot(L('ठीक है! 😊 भाषा सेट हो गई। अब चलिए शुरू करते हैं।', 'Great! 😊 Language set. Let\u2019s begin.', 'Theek hai! Bhasha set ho gayi. Chaliye shuru karte hain.'));
            r.step++; botSayStep(); return;
        }
        case 'name': r.data.name = a || null; ok = !!r.data.name; break;
        case 'age': r.data.age = parseInt(a, 10) || null; ok = !!r.data.age && r.data.age > 0 && r.data.age < 120; break;
        case 'type': if (!RESCUE_TYPES[a]) ok = false; else r.data.type = a; break;
        case 'conscious': r.data.conscious = !no; break;
        case 'breathing': r.data.breathing = !no; break;
        case 'bleeding': r.data.bleeding = yes; break;
        case 'location': {
            const city = CITY_LOCATIONS.find(c => c.name.toLowerCase() === a.toLowerCase());
            if (city) { r.data.location = city.name; r.data.lat = city.lat; r.data.lng = city.lng; }
            else { const m = a.match(/-?[\d.]+/g); if (m && m.length >= 2) { r.data.lat = parseFloat(m[0]); r.data.lng = parseFloat(m[1]); r.data.location = a; } else ok = false; }
            break;
        }
        case 'contact': r.data.contact = a || null; ok = !!r.data.contact; break;
        case 'medical': r.data.medical = no ? 'None' : a || 'None'; break;
        case 'support': {
            const s = a.toLowerCase();
            r.data.support = { ambulance: s.includes('ambulance'), blood: s.includes('blood'), hospital: s.includes('hospital') };
            if (!Object.values(r.data.support).some(Boolean)) r.data.support.ambulance = true;
            break;
        }
        case 'priority': r.priorityConfirmed = yes; if (!yes) r.data.priority = r.data.priority === 'Critical' ? 'High' : 'Medium'; break;
        case 'summary': r.summaryConfirmed = yes; break;
    }
    if (!ok) { chatBot(L('कृपया सही जानकारी दें। 🙏', 'Please give valid info. 🙏', 'Kripya sahi jaankari dein.')); showChips(step.opts || []); return; }
    r.step++;
    if (r.step >= RESCUE_STEPS.length) finishRescue();
    else botSayStep();
}

function finishRescue() {
    const r = state.rescue;
    if (!r.summaryConfirmed) r.summaryConfirmed = true;
    const type = RESCUE_TYPES[r.data.type];
    const severity = r.data.priority || 'High';
    const loc = { lat: r.data.lat || 28.6600, lng: r.data.lng || 77.4500 };
    const name = r.data.name || 'Patient';
    r.caseId = 'MRS-' + Math.floor(100000 + Math.random() * 900000);
    const sup = supportLabel(r.data);

    const req = { id: r.caseId, name, lat: loc.lat, lng: loc.lng, type: type.type, severity, support: sup, status: 'Assigned', city: r.data.location || 'Delhi-NCR' };
    state.requests.unshift(req);

    if (r.data.support.ambulance) {
        startDispatch({ id: r.caseId, name, patient: { lat: loc.lat, lng: loc.lng }, type: type.type, severity, support: sup });
    }

    chatBot(L('✅ Emergency Case ID: ' + r.caseId + '\nकृपया इसे नोट कर लें।', '✅ Emergency Case ID: ' + r.caseId + '\nPlease note it down.', '✅ Emergency Case ID: ' + r.caseId + '. Isse note kar lein.'));

    if (r.data.support.ambulance) {
        setTimeout(() => chatBot(L('🚑 निकटतम suitable ambulance खोजी जा रही है…', '🚑 Searching nearest suitable ambulance…', '🚑 Nikat-tam suitable ambulance dhundhi ja rahi hai…')), 650);
        setTimeout(() => {
            const d = state.dispatch;
            chatBot(L('🚑 Ambulance ' + (d ? d.amb.id : '') + ' assigned।\nलगभग ' + (d ? d.etaPickMin : '8') + ' मिनट में पहुँचेगी।\nRecommended hospital: ' + (d ? d.hosp.name : '') + '\n🚦 Ambulance रास्ते में है — Ambulance tab me live track करें।',
                '🚑 Ambulance ' + (d ? d.amb.id : '') + ' assigned.\nArriving in approx ' + (d ? d.etaPickMin : '8') + ' min.\nRecommended hospital: ' + (d ? d.hosp.name : '') + '\n🚦 Ambulance is en route — live track in the Ambulance tab.',
                '🚑 Ambulance ' + (d ? d.amb.id : '') + ' assign hui. Lagbhag ' + (d ? d.etaPickMin : '8') + ' min me pahunchegi. Recommended hospital: ' + (d ? d.hosp.name : '') + '. Ambulance tab me live track karein.'));
        }, 1700);
    }
    if (r.data.support.blood) {
        setTimeout(() => {
            const total = state.bloodStock.reduce((t, s) => t + s.units_available, 0);
            chatBot(L('🩸 Blood availability check: कुल ' + total + ' units ' + state.blood.length + ' blood banks me available। ज़रूरत हो तो Blood Bank tab me request karein।', '🩸 Blood availability check: ' + total + ' units across ' + state.blood.length + ' banks. Request in the Blood Bank tab if needed.', '🩸 Blood availability: kul ' + total + ' units ' + state.blood.length + ' banks me. Zaroorat ho to Blood Bank tab me request karein.'));
        }, 2500);
    }
    if (severity === 'Critical') {
        setTimeout(() => chatBot(L('🏥 Hospital Alert भेज दिया गया है — pre-arrival info के साथ।', '🏥 Hospital alert sent with pre-arrival info.', '🏥 Hospital alert pre-arrival info ke saath bhej diya gaya hai.')), 3300);
    }
    setTimeout(() => chatBot(L('⚠️ Basic safety guidance (मैं डॉक्टर नहीं हूँ — verified official protocols):\n' + safetyText(r.data.type), '⚠️ Basic safety guidance (I am not a doctor — official protocols):\n' + safetyText(r.data.type), '⚠️ Basic safety guidance:\n' + safetyText(r.data.type))), 4100);
    setTimeout(() => chatBot(L('🚦 Status: Ambulance रास्ते में है।\nक्या आपको किसी और सहायता की आवश्यकता है? 🙏', '🚦 Status: Ambulance is en route.\nDo you need any other assistance? 🙏', '🚦 Status: Ambulance raste me hai. Kya aapko kisi aur sahayata ki zaroorat hai?')), 5200);

    r.done = true;
    r.active = false;
    state.rescue = r;
    setTimeout(restoreChips, 5600);
}

/* ---- Lifestyle profile (optional, consent-based) ---- */
const LIFESTYLE_KEY = 'medifast_lifestyle';
function loadLifestyle() { try { return JSON.parse(localStorage.getItem(LIFESTYLE_KEY)) || null; } catch (e) { return null; } }
function saveLifestyle(p) { localStorage.setItem(LIFESTYLE_KEY, JSON.stringify(p)); }

const LIFESTYLE_STEPS = [
    { key: 'consent', q: () => L('क्या आप अपनी lifestyle info share करना चाहते हैं? 🔒 यह data सिर्फ आपके device (local storage) me save hoga — aapki permission के बिना कहीं share नहीं किया जाएगा।', 'Would you like to share your lifestyle info? 🔒 This data is saved only on your device (local storage) and never shared without your consent.', 'Kya aap apni lifestyle info share karna chahte hain? Ye data sirf aapke device me save hoga, permission ke bina kahin share nahi hoga.'), opts: ['हाँ / Yes', 'नहीं / No'] },
    { key: 'activity', q: () => L('Daily activity level क्या है?', 'What is your daily activity level?', 'Daily activity level kya hai?'), opts: ['Sedentary', 'Light', 'Active', 'Very Active'] },
    { key: 'sleep', q: () => L('Raat me kitne घंटे सोते हैं?', 'How many hours of sleep per night?', 'Raat me kitne ghante sote hain?'), opts: ['Less than 6', '6–7', '7–8', 'More than 8'] },
    { key: 'water', q: () => L('Roj kitne glasses पानी पीते हैं?', 'How many glasses of water daily?', 'Roj kitne glasses paani peete hain?'), opts: ['Less than 4', '4–6', '7–8', 'More than 8'] },
    { key: 'food', q: () => L('Food preference?', 'Food preference?', 'Food preference?'), opts: ['Vegetarian', 'Non-Veg', 'Mixed', 'Junk-heavy'] },
    { key: 'smoke', q: () => L('Smoking / alcohol status?', 'Smoking / alcohol status?', 'Smoking / alcohol status?'), opts: ['No', 'Occasional', 'Regular'] },
    { key: 'exercise', q: () => L('Exercise routine?', 'Exercise routine?', 'Exercise routine?'), opts: ['Daily', 'Weekly', 'Rarely', 'None'] },
    { key: 'contact', q: () => L('Emergency contact (नाम + number)?', 'Emergency contact (name + number)?', 'Emergency contact (naam + number)?') },
    { key: 'access', q: () => L('कोई accessibility need? (नहीं / wheelchair / visual / hearing / other)', 'Any accessibility needs? (none / wheelchair / visual / hearing / other)', 'Koi accessibility need? (nahin / wheelchair / visual / hearing / other)') },
];

function startLifestyle() {
    if (!state.lifestyleProfile) state.lifestyleProfile = {};
    state.lifestyle = { active: true, step: 0, done: false, data: {} };
    lifestyleSay();
}
function endLifestyle() {
    state.lifestyle = { active: false, step: 0, done: false, data: {} };
    restoreChips();
}
function lifestyleSay() {
    const st = LIFESTYLE_STEPS[state.lifestyle.step];
    chatBot(st.q());
    showChips(st.opts || []);
}
function lifestyleAnswer(ans) {
    const st = LIFESTYLE_STEPS[state.lifestyle.step];
    const a = ans.trim();
    const yes = /हाँ|^yes|^ha\b/i.test(a);
    const no = /नहीं|^no|^na\b/i.test(a);
    if (st.key === 'consent') {
        if (no) {
            chatBot(L('कोई बात नहीं! 🙏 आपकी privacy का सम्मान करते हैं। किसी और चीज़ में मदद?', 'No problem! 🙏 We respect your privacy. Anything else?', 'Koi baat nahi! Aapki privacy ka samman karte hain. Kisi aur cheez me madad?'));
            endLifestyle(); return;
        }
        state.lifestyle.data.consent = true;
    } else if (st.key === 'contact') {
        state.lifestyle.data.contact = a || null;
    } else {
        state.lifestyle.data[st.key] = a;
    }
    state.lifestyle.step++;
    if (state.lifestyle.step >= LIFESTYLE_STEPS.length) finishLifestyle();
    else lifestyleSay();
}
function finishLifestyle() {
    const d = state.lifestyle.data;
    saveLifestyle({ consent: true, data: d, updated: new Date().toISOString() });
    state.lifestyleProfile = { consent: true, data: d };
    let tip = '';
    if (d.activity === 'Sedentary' || d.exercise === 'None') tip += '\n· Thoda daily walk (10–15 min) se fark pad sakta hai 🚶';
    if (d.sleep === 'Less than 6') tip += '\n· 7–8 ghante neend ka target rakhein 😴';
    if (d.water === 'Less than 4') tip += '\n· Pani thoda badhayein (roz 6–8 glasses) 💧';
    if (d.food === 'Junk-heavy') tip += '\n· Fruits/veg thoda include karein 🥗';
    if (d.smoke === 'Regular') tip += '\n· Smoking reduce karna achha rahega (mai judge nahi karta, bas support me hoon) 🤝';
    chatBot(L('✅ Lifestyle profile save ho gaya (consent ke saath, sirf aapke device par)। 🙏' + (tip || '\n· Aapka profile balanced hai, aise hi continue karein! 👏'),
        '✅ Lifestyle profile saved with your consent, only on your device. 🙏' + (tip || '\n· Your profile looks balanced, keep it up! 👏'),
        '✅ Lifestyle profile save ho gaya. ' + (tip || 'Aapka profile balanced hai!')));
    state.lifestyle.active = false;
    state.lifestyle.done = true;
    setTimeout(restoreChips, 2600);
}

/* ---------- Live state ---------- */
const state = {
    weather: 'normal',
    trend: {},            // recent admission drift per dept
    occupied: {},         // currently occupied beds per dept
    emQueue: [],
    lang: 'en-IN',
    floor: 1,             // active map floor
    live: false,          // live simulation running?
    liveTimer: null,
    arrivals: [],         // recent patient-flow arrivals
    hospitals: loadHospitals(),
    activeHospitalId: null,
    hospData: {},         // per-hospital simulation snapshots
    editingId: null,      // hospital being edited
    ry: 45,               // 3D scene rotation (deg)
    routePlan: null,      // last computed multi-floor route
    requests: JSON.parse(JSON.stringify(DEFAULT_REQUESTS)),
    dispatch: null,       // active ambulance dispatch state
    dispatchTimer: null,
    liveTrack: false,     // live tracking paused?
    reqLive: false,       // emergency requests live?
    reqTimer: null,
    blood: JSON.parse(JSON.stringify(BLOOD_BANKS)),
    bloodStock: JSON.parse(JSON.stringify(BLOOD_STOCK)),
    donors: JSON.parse(JSON.stringify(DEFAULT_DONORS)),
    bloodFeed: [],
    bloodLog: [],
    bloodTimer: null,
    bbMap: null,
    bbLayers: null,
    bbFind: null,
    chatGreeted: false,
    chatLang: 'auto',   // 'auto' | 'hi' | 'en' | 'hinglish'
    rescue: { active: false, step: 0, lang: 'hi', caseId: null, done: false, data: {} },
    lifestyle: { active: false, step: 0, done: false, data: {} },
    lifestyleProfile: loadLifestyle(),
};
state.activeHospitalId = state.hospitals[0] ? state.hospitals[0].id : null;

/* Simulate current occupancy + trend for each department (active hospital) */
function seedState() {
    const id = state.activeHospitalId;
    if (!state.hospData[id]) state.hospData[id] = {};
    const occupied = {}, trend = {};
    DEPARTMENTS.forEach(d => {
        const occ = clamp(Math.round(d.beds * (d.baseline / 100) * rnd(0.9, 1.15)), 0, d.beds);
        occupied[d.id] = occ;
        trend[d.id] = rnd(-0.6, 0.8);
    });
    state.hospData[id].occupied = occupied;
    state.hospData[id].trend = trend;
    state.occupied = occupied;
    state.trend = trend;
}
seedState();

/* ---------- AI ENGINE ---------- */
const AI = {
    features: [
        { id: 'hour',  label: 'Time of day (peak hrs)' },
        { id: 'day',   label: 'Day of week' },
        { id: 'weather', label: 'Weather / season' },
        { id: 'trend', label: 'Recent admissions trend' },
        { id: 'staff', label: 'Staff availability' },
    ],

    /* Feature values in [-1, 1] */
    hourFactor(d) {
        const h = new Date().getHours();
        const peak = [10, 19]; // morning & evening peaks
        let f = 0;
        peak.forEach(p => { f += Math.exp(-Math.pow((h - p) / 3.2, 2)); });
        return (f - 0.55) * 1.7;
    },
    dayFactor() {
        const map = { 1: 0.14, 2: 0.07, 3: 0.04, 4: 0.03, 5: 0.06, 6: -0.06, 0: -0.13 };
        return map[new Date().getDay()];
    },
    weatherFactor(d) {
        const w = state.weather;
        const t = d.weather[w];
        return t !== undefined ? t : 0;
    },
    trendFactor(d) { return state.trend[d.id]; },
    staffFactor(d) {
        const loadNow = this.currentLoad(d);
        // low staff -> pushes load up
        return (loadNow > 60 && d.staff < 12) ? 0.08 : 0;
    },

    /* Feature * weight contributions around a baseline */
    contributions(d) {
        const b = d.baseline;
        return {
            hour:    { v: this.hourFactor(d) * 12 },
            day:     { v: this.dayFactor() * 9 },
            weather: { v: this.weatherFactor(d) * 100 * 0.55 },
            trend:   { v: this.trendFactor(d) * 7 },
            staff:   { v: this.staffFactor(d) * 30 },
            base:    { v: b },
        };
    },

    currentLoad(d) {
        if (d.beds === 0) return d.baseline;
        return clamp((state.occupied[d.id] / d.beds) * 100, 0, 100);
    },

    /* Predict load at horizon (hours ahead). horizon 0 = now */
    predict(d, horizon) {
        const c = this.contributions(d);
        const decay = Math.exp(-horizon * 0.28); // revert to baseline over time
        let load = c.base.v + (c.hour.v + c.day.v + c.weather.v + c.trend.v + c.staff.v) * decay;
        load += horizon > 0 ? rnd(-4, 4) : 0;
        load = clamp(load, 3, 100);
        return { load: Math.round(load), c };
    },

    confidence(horizon) {
        const h = new Date().getHours();
        const peak = (Math.abs(h - 10) < 3 || Math.abs(h - 19) < 3);
        const w = state.weather === 'normal' ? 0 : 4;
        const conf = 94 - (peak ? 2 : 5) - horizon * 2.5 - w;
        return Math.round(clamp(conf, 58, 97));
    },

    statusOf(load) {
        if (load >= 85) return { text: 'CRITICAL', cls: 'danger' };
        if (load >= 65) return { text: 'HIGH LOAD', cls: 'warn' };
        return { text: 'NORMAL', cls: 'good' };
    },

    /* Waiting time in minutes */
    predictWait(d, horizon) {
        const load = this.predict(d, horizon).load;
        const wait = d.waitBase * (0.35 + load / 70) * rnd(0.9, 1.1);
        return Math.max(3, Math.round(wait));
    },

    /* Bed forecast: free now / 2h / 4h / 6h */
    predictBeds(d) {
        if (d.beds === 0) return { now: 0, h2: 0, h4: 0, h6: 0 };
        const occNow = state.occupied[d.id];
        const loadNow = this.currentLoad(d);
        const freeNow = d.beds - occNow;
        const h = (hor) => {
            const load = this.predict(d, hor).load;
            const occ = clamp(Math.round(occNow * (load / Math.max(loadNow, 5))), 0, d.beds);
            return d.beds - occ;
        };
        return { now: freeNow, h2: h(2), h4: h(4), h6: h(6) };
    },
};

/* ---------- LIVE PATIENT-FLOW SIMULATION ---------- */
const NAMES = ['Rohan', 'Ayesha', 'Vikram', 'Priya', 'Arjun', 'Sneha', 'Kabir', 'Ananya',
    'Rahul', 'Meera', 'Dev', 'Ishita', 'Sahil', 'Naina', 'Aditya', 'Kavya', 'Manish',
    'Pooja', 'Ravi', 'Simran', 'Farhan', 'Zoya', 'Tara', 'Amit', 'Divya', 'Harsh', 'Lakshmi'];

/* ---------- HOSPITALS ---------- */
function loadHospitals() {
    try {
        const raw = localStorage.getItem('medifast_hospitals');
        return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_HOSPITALS));
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_HOSPITALS)); }
}

function saveHospitals() {
    try { localStorage.setItem('medifast_hospitals', JSON.stringify(state.hospitals)); } catch (e) { }
}

function currentHosp() {
    return state.hospitals.find(h => h.id === state.activeHospitalId) || state.hospitals[0];
}

/* Load a hospital's saved simulation snapshot into the working set */
function loadHospData(id) {
    if (!state.hospData[id]) {
        state.activeHospitalId = id;
        seedState();
        return;
    }
    state.occupied = state.hospData[id].occupied;
    state.trend = state.hospData[id].trend;
}

function refreshHospSwitch() {
    const sel = $('#hosp-switch');
    if (!sel) return;
    if (!state.hospitals.some(h => h.id === state.activeHospitalId)) {
        state.activeHospitalId = state.hospitals[0] ? state.hospitals[0].id : null;
    }
    sel.innerHTML = state.hospitals.map(h =>
        `<option value="${h.id}" ${h.id === state.activeHospitalId ? 'selected' : ''}>🏥 ${h.name}</option>`).join('');
}

function updateHospitalBadges() {
    const h = currentHosp();
    const label = h ? `Active hospital: ${h.name} — ${h.address}` : 'No hospital selected';
    ['#hosp-badge-predict', '#hosp-badge-beds', '#hosp-badge-admin'].forEach(s => {
        const el = $(s);
        if (el) el.innerHTML = `<span class="chip chip-tag">🏥 ${label}</span>`;
    });
}

function switchHospital(id) {
    if (id === state.activeHospitalId) return;
    state.activeHospitalId = id;
    loadHospData(id);
    refreshHospSwitch();
    updateHospitalBadges();
    renderTicker();
    refreshActiveViews();
    toast('Switched to ' + (currentHosp() ? currentHosp().name : ''));
}

function renderFacilityPicker() {
    const box = $('#facility-picker');
    box.innerHTML = '';
    const chosen = new Set($('#hospital-form').dataset.selected ? $('#hospital-form').dataset.selected.split(',') : []);
    FACILITIES.forEach(f => {
        const el = document.createElement('div');
        el.className = 'facility-opt' + (chosen.has(f) ? ' checked' : '');
        el.textContent = f;
        el.onclick = () => {
            el.classList.toggle('checked');
            const sel = $$('#facility-picker .facility-opt.checked').map(x => x.textContent);
            $('#hospital-form').dataset.selected = sel.join(',');
        };
        box.appendChild(el);
    });
}

function selectedFacilities() {
    return $$('#facility-picker .facility-opt.checked').map(x => x.textContent);
}

function renderHospitals() {
    const q = $('#hosp-search') ? $('#hosp-search').value.toLowerCase() : '';
    const list = $('#hospital-list');
    const hs = state.hospitals.filter(h =>
        !q || h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q) ||
        (h.facilities || []).some(f => f.toLowerCase().includes(q)));

    $('#hosp-count').textContent = state.hospitals.length;
    $('#hosp-total-beds').textContent = state.hospitals.reduce((s, h) => s + (+h.beds || 0), 0);
    $('#hosp-with-icu').textContent = state.hospitals.filter(h => (h.facilities || []).includes('ICU')).length;
    $('#hosp-with-ambulance').textContent = state.hospitals.filter(h => (h.facilities || []).includes('Ambulance 24x7')).length;
    $('#hosp-saved-badge').textContent = state.hospitals.length + ' saved';

    if (!hs.length) {
        list.innerHTML = '<div class="hosp-empty">No hospitals found. Add one using the form.</div>';
        return;
    }
    list.innerHTML = hs.map(h => `
        <div class="hospital-card">
            <div class="h-name">🏥 ${h.name}</div>
            <div class="h-addr">📍 ${h.address}</div>
            <div class="h-meta">
                <span>📞 ${h.phone || '—'}</span>
                <span>🛏️ ${h.beds || 0} beds</span>
            </div>
            <div class="h-facilities">${(h.facilities || []).map(f => `<span class="f-chip">${f}</span>`).join('')}</div>
            <div class="h-actions">
                <button class="btn btn-gray btn-small" data-edit="${h.id}">✏️ Edit</button>
                <button class="btn btn-danger btn-small" data-del="${h.id}">🗑️ Delete</button>
            </div>
        </div>`).join('');

    $$('#hospital-list [data-edit]').forEach(b => b.addEventListener('click', () => startEditHospital(b.dataset.edit)));
    $$('#hospital-list [data-del]').forEach(b => b.addEventListener('click', () => deleteHospital(b.dataset.del)));
}

function startEditHospital(id) {
    const h = state.hospitals.find(x => x.id === id);
    if (!h) return;
    state.editingId = id;
    $('#hosp-name').value = h.name;
    $('#hosp-address').value = h.address;
    $('#hosp-phone').value = h.phone || '';
    $('#hosp-beds').value = h.beds || 0;
    $('#hospital-form').dataset.selected = (h.facilities || []).join(',');
    renderFacilityPicker();
    $('#hospital-form').querySelector('button[type="submit"]').textContent = '💾 Update Hospital';
    $('#hospital-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function deleteHospital(id) {
    state.hospitals = state.hospitals.filter(x => x.id !== id);
    if (state.activeHospitalId === id) {
        state.activeHospitalId = state.hospitals[0] ? state.hospitals[0].id : null;
        loadHospData(state.activeHospitalId);
        refreshActiveViews();
    }
    saveHospitals();
    renderHospitals();
    refreshHospSwitch();
    updateHospitalBadges();
    toast('Hospital deleted');
}

function submitHospital(e) {
    e.preventDefault();
    const name = $('#hosp-name').value.trim();
    const address = $('#hosp-address').value.trim();
    const facilities = selectedFacilities();
    if (!name || !address) { toast('Name and address are required'); return; }
    if (!facilities.length) { toast('Select at least one facility'); return; }

    const wasEditing = !!state.editingId;
    if (wasEditing) {
        const h = state.hospitals.find(x => x.id === state.editingId);
        if (h) {
            h.name = name; h.address = address;
            h.phone = $('#hosp-phone').value.trim();
            h.beds = parseInt($('#hosp-beds').value, 10) || 0;
            h.facilities = facilities;
        }
        state.editingId = null;
    } else {
        state.hospitals.push({
            id: 'h' + Date.now(),
            name, address,
            phone: $('#hosp-phone').value.trim(),
            beds: parseInt($('#hosp-beds').value, 10) || 0,
            facilities,
        });
    }
    saveHospitals();
    e.target.reset();
    $('#hospital-form').dataset.selected = '';
    renderFacilityPicker();
    $('#hospital-form').querySelector('button[type="submit"]').textContent = '📥 Add Hospital';
    renderHospitals();
    refreshHospSwitch();
    updateHospitalBadges();
    toast(wasEditing ? 'Hospital updated ✨' : 'Hospital added ✨');
}

/* ================= AMBULANCE DISPATCH & LIVE TRACKING ================= */
const GEO = { minLat: 28.640, maxLat: 28.690, minLng: 77.435, maxLng: 77.475, W: 1000, H: 600 };
const geoXY = (lat, lng) => ({
    x: (lng - GEO.minLng) / (GEO.maxLng - GEO.minLng) * GEO.W,
    y: (GEO.maxLat - lat) / (GEO.maxLat - GEO.minLat) * GEO.H,
});
const haversine = (a, b) => {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
};

/* AI: nearest available ambulance (ALS for critical/high) */
function assignAmbulance(severity, pLat, pLng) {
    const wantALS = severity === 'Critical' || severity === 'High';
    let pool = AMBULANCES.filter(a => a.status === 'Available');
    if (wantALS) {
        const als = pool.filter(a => a.type === 'ALS');
        if (als.length) pool = als;
    }
    if (!pool.length) pool = AMBULANCES.filter(a => a.status === 'Available');
    if (!pool.length) return null;
    pool.sort((a, b) => haversine(a, { lat: pLat, lng: pLng }) - haversine(b, { lat: pLat, lng: pLng }));
    return pool[0];
}

/* AI: best hospital = matching specialty + ICU (critical) + lowest load + nearest */
function pickHospital(type, severity, pLat, pLng) {
    const spec = EMERGENCY_TYPES[type] ? EMERGENCY_TYPES[type].spec : 'General';
    let pool = HOSPITAL_NETWORK.slice();
    const specPool = pool.filter(h => h.spec.includes(spec));
    if (specPool.length) pool = specPool;
    if (severity === 'Critical') {
        const withIcu = pool.filter(h => h.icu > 0);
        if (withIcu.length) pool = withIcu;
    }
    pool.sort((a, b) => (a.load - b.load) || (haversine(a, { lat: pLat, lng: pLng }) - haversine(b, { lat: pLat, lng: pLng })));
    return pool[0];
}

function requestTelemetry(status) {
    const d = state.dispatch;
    if (!d) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const speed = (status === 'OnRoute' || status === 'ToHospital') ? Math.round(d.speed * (0.8 + Math.random() * 0.5)) : 0;
    d.telemetry.unshift({ amb: d.amb.id, time: now, lat: d.amb.lat.toFixed(4), lng: d.amb.lng.toFixed(4), speed, status });
    if (d.telemetry.length > 14) d.telemetry.pop();
}

function stopDispatch() {
    if (state.dispatchTimer) { clearInterval(state.dispatchTimer); state.dispatchTimer = null; }
    if (state.dispatch && state.dispatch.phase !== 'done') state.dispatch.amb.status = 'Available';
    state.liveTrack = false;
    updateTrackBtn();
}

function updateTrackBtn() {
    const b = $('#btn-live-track');
    if (b) b.textContent = state.liveTrack ? '⏸ Pause Live' : '▶ Resume Live';
    const dot = $('#track-live-dot');
    if (dot) dot.classList.toggle('on', state.liveTrack);
}

function pauseLiveTrack() {
    if (state.dispatchTimer) { clearInterval(state.dispatchTimer); state.dispatchTimer = null; }
    state.liveTrack = false;
    updateTrackBtn();
    toast('Live tracking paused');
}

function resumeLiveTrack() {
    if (!state.dispatch || state.dispatch.phase === 'done') { toast('No active dispatch to track'); return; }
    if (state.dispatchTimer) clearInterval(state.dispatchTimer);
    state.dispatchTimer = setInterval(tickDispatch, 1500);
    state.liveTrack = true;
    updateTrackBtn();
    toast('Live tracking resumed 📡');
}

/* Fetch a road-following driving route from OSRM (falls back to straight line) */
function fetchRoute(from, to) {
    const url = 'https://router.project-osrm.org/route/v1/driving/'
        + from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat
        + '?overview=full&geometries=geojson';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    return fetch(url, { signal: ctrl.signal })
        .then(r => r.json())
        .then(j => {
            clearTimeout(t);
            if (j.code !== 'Ok' || !j.routes || !j.routes.length) return null;
            const geom = j.routes[0].geometry.coordinates;
            return {
                points: geom.map(c => ({ lat: c[1], lng: c[0] })),
                distM: j.routes[0].distance,
                durS: j.routes[0].duration,
            };
        })
        .catch(() => { clearTimeout(t); return null; });
}

/* Build a single ordered road path [start → patient → hospital] with cumulative meters */
function buildPath(d) {
    if (d.route1 && d.route2) {
        const pts = d.route1.points.concat(d.route2.points);
        let cum = [0], acc = 0;
        for (let i = 1; i < pts.length; i++) { acc += haversine(pts[i - 1], pts[i]) * 1000; cum.push(acc); }
        return { pts, cum, total: d.route1.distM + d.route2.distM, road: true };
    }
    const pts = [d.start, d.patient, d.hosp];
    let cum = [0], acc = 0;
    for (let i = 1; i < pts.length; i++) { acc += haversine(pts[i - 1], pts[i]) * 1000; cum.push(acc); }
    return { pts, cum, total: acc, road: false };
}

function posAlongPath(path, adv) {
    const { pts, cum } = path;
    if (adv <= 0) return pts[0];
    for (let i = 1; i < cum.length; i++) {
        if (adv <= cum[i]) {
            const a = pts[i - 1], b = pts[i];
            const segLen = (cum[i] - cum[i - 1]) || 1;
            const f = clamp((adv - cum[i - 1]) / segLen, 0, 1);
            return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
        }
    }
    return pts[pts.length - 1];
}

function startDispatch(req) {
    stopDispatch();
    const amb = assignAmbulance(req.severity, req.patient.lat, req.patient.lng);
    if (!amb) { toast('No ambulance available right now'); return; }
    const hosp = pickHospital(req.type, req.severity, req.patient.lat, req.patient.lng);
    amb.status = 'Busy';

    const speed = amb.type === 'ALS' ? 45 : 35;
    const d = {
        req, amb, hosp, phase: 'toPatient',
        start: { lat: amb.lat, lng: amb.lng },
        patient: req.patient, speed,
        etaPickMin: 2, etaArriveMin: 5,
        adv: 0, telemetry: [],
        route1: null, route2: null, path: null, _resolved: 0,
    };
    state.dispatch = d;
    state.liveTrack = true;
    updateTrackBtn();
    requestTelemetry('OnRoute');
    renderAmbView();

    // GPS road routing — animate along real roads when both legs resolve
    fetchRoute(d.start, d.patient).then(r => { d.route1 = r; d._resolved++; maybeRunDispatch(); });
    fetchRoute(d.patient, d.hosp).then(r => { d.route2 = r; d._resolved++; maybeRunDispatch(); });
    setTimeout(maybeRunDispatch, 8000); // safety fallback if a request hangs

    function maybeRunDispatch() {
        if (!state.dispatch || state.dispatch !== d || state.dispatchTimer) return;
        if (d._resolved < 2 && !d._safety) return;
        d._safety = true;
        if (d.route1 && d.route2) {
            d.etaPickMin = Math.max(1, Math.round(d.route1.durS / 60));
            d.etaArriveMin = Math.max(1, Math.round((d.route1.durS + d.route2.durS) / 60));
        } else {
            const seg1 = haversine(amb, d.patient), seg2 = haversine(d.patient, d.hosp);
            d.etaPickMin = Math.max(1, Math.round(seg1 / speed * 60));
            d.etaArriveMin = Math.max(1, Math.round((seg1 + seg2) / speed * 60));
        }
        d.path = buildPath(d);
        state.dispatchTimer = setInterval(tickDispatch, 1500);
        renderAmbView();
    }
}

function tickDispatch() {
    const d = state.dispatch;
    if (!d) return;
    if (!d.path) d.path = buildPath(d);

    const stepM = d.speed * 1000 * (1.5 / 3600); // meters per tick
    d.adv += stepM;

    if (d.adv >= d.path.total) {
        d.adv = d.path.total;
        d.phase = 'done';
        d.amb.lat = d.hosp.lat; d.amb.lng = d.hosp.lng;
        d.amb.status = 'Available';
        requestTelemetry('Completed');
        const r = state.requests.find(x => x.id === d.req.id);
        if (r) r.status = 'Completed';
        stopDispatch();
        toast('Ambulance ' + d.amb.id + ' arrived at ' + d.hosp.name + ' 🚑');
    } else {
        const pos = posAlongPath(d.path, d.adv);
        d.amb.lat = pos.lat; d.amb.lng = pos.lng;
        const patientDist = d.route1 ? d.route1.distM : haversine(d.start, d.patient) * 1000;
        if (d.adv >= patientDist && d.phase !== 'toHospital') {
            d.phase = 'toHospital';
            requestTelemetry('PatientPicked');
        } else {
            requestTelemetry(d.phase === 'toPatient' ? 'OnRoute' : 'ToHospital');
        }
    }
    renderAmbView();
}

function renderDispatchDecision() {
    const box = $('#dis-decision');
    const d = state.dispatch;
    if (!d) { box.className = 'route-result empty'; box.innerHTML = '<p class="muted">No active dispatch. Fill the form and hit "Dispatch Ambulance".</p>'; return; }
    box.className = 'route-result';
    const spec = EMERGENCY_TYPES[d.req.type].spec;
    const specOK = d.hosp.spec.includes(spec);
    const roadNote = (d.route1 && d.route2) ? '🛣️ GPS route follows real roads (OSRM)' : '➡️ GPS fallback: straight-line route';
    const alertMin = d.etaArriveMin || Math.max(1, Math.round((d.path ? d.path.total : 4000) / (d.speed * 1000 / 60)));
    box.innerHTML = `
        <div class="route-rec">
            <div class="rec-icon">${EMERGENCY_TYPES[d.req.type].icon}</div>
            <div>
                <h4>Patient: ${d.req.name} — ${d.req.severity.toUpperCase()}</h4>
                <p>📍 ${d.patient.lat.toFixed(4)}, ${d.patient.lng.toFixed(4)}</p>
            </div>
        </div>
        <div class="xpl" style="margin-bottom:10px">
            <div class="xpl-title">&#128662; AI finds: Nearest Available ${d.amb.type} &rarr; ${d.amb.id}</div>
            <div class="dis-badge">ETA to patient: <b>${d.etaPickMin} min</b> · Equipment: ${d.amb.equip.join(', ')}</div>
        </div>
        <div class="xpl" style="margin-bottom:10px">
            <div class="xpl-title">&#127973; Best Hospital: ${d.hosp.id} — ${d.hosp.name}</div>
            <div class="dis-badge">${spec} specialty: <b>${specOK ? 'Available ✓' : 'General ✓'}</b> · ICU beds: <b>${d.hosp.icu} ✓</b> · Load ${d.hosp.load}%</div>
        </div>
        <div class="xpl" style="margin-bottom:10px">
            <div class="xpl-title">&#128640; Live GPS Road Routing</div>
            <div class="dis-badge">${roadNote} · Route distance: <b>${((d.path ? d.path.total : 0) / 1000).toFixed(1)} km</b> · ETA arrival: <b>${d.etaArriveMin} min</b></div>
        </div>
        ${d.req.severity === 'Critical' ? `
        <div class="alert-item critical">
            <div>&#128680;</div>
            <div>
                <div class="a-title">Hospital Alert</div>
                <div class="a-body">"Critical ${d.req.type.toLowerCase()} patient arriving in ${alertMin} minutes" — ${d.hosp.name}</div>
            </div>
        </div>` : ''}`;
    $('#track-phase').textContent = d.phase === 'done' ? 'Arrived' : d.phase === 'toPatient' ? 'On Route to Patient' : 'To Hospital';
}

function renderTrackMap() {
    const box = $('#track-map');
    if (!box) return;
    const parts = [];
    for (let gx = 0; gx <= 5; gx++) { const x = gx / 5 * GEO.W; parts.push(`<line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="${GEO.H}"/>`); }
    for (let gy = 0; gy <= 3; gy++) { const y = gy / 3 * GEO.H; parts.push(`<line class="grid-line" x1="0" y1="${y}" x2="${GEO.W}" y2="${y}"/>`); }
    parts.push('<defs><linearGradient id="ambgrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a00"/><stop offset="1" stop-color="#ff2e8b"/></linearGradient></defs>');

    HOSPITAL_NETWORK.forEach(h => {
        const p = geoXY(h.lat, h.lng);
        parts.push(`<rect class="hospital-marker" x="${p.x - 7}" y="${p.y - 7}" width="14" height="14" rx="3"/>`);
        parts.push(`<text class="hospital-label" x="${p.x}" y="${p.y - 13}" text-anchor="middle">${h.id} ${h.name} (${h.load}%)</text>`);
    });

    const d = state.dispatch;
    if (d) {
        const sp = geoXY(d.start.lat, d.start.lng);
        const pp = geoXY(d.patient.lat, d.patient.lng);
        const hp = geoXY(d.hosp.lat, d.hosp.lng);
        const ap = geoXY(d.amb.lat, d.amb.lng);
        parts.push(`<path class="route-line" d="M ${sp.x} ${sp.y} L ${pp.x} ${pp.y} L ${hp.x} ${hp.y}"/>`);
        parts.push(`<line class="live-line" x1="${sp.x}" y1="${sp.y}" x2="${ap.x}" y2="${ap.y}"/>`);
        parts.push(`<circle class="patient-marker" cx="${pp.x}" cy="${pp.y}" r="7"/>`);
        parts.push(`<text x="${pp.x}" y="${pp.y + 25}" text-anchor="middle" font-size="12" font-weight="800" fill="#e5484d">PATIENT ${d.req.name}</text>`);
        parts.push(`<circle class="amb-marker amb-pulse" cx="${ap.x}" cy="${ap.y}" r="9"/>`);
        parts.push(`<text class="amb-label" x="${ap.x}" y="${ap.y - 15}" text-anchor="middle">🚑 ${d.amb.id}</text>`);
    }

    AMBULANCES.forEach(a => {
        if (d && a.id === d.amb.id) return;
        const p = geoXY(a.lat, a.lng);
        const col = a.status === 'Available' ? '#17b26a' : a.status === 'Busy' ? '#ff2e8b' : '#f79009';
        parts.push(`<circle fill="${col}" cx="${p.x}" cy="${p.y}" r="6"/>`);
        parts.push(`<text class="amb-label" x="${p.x}" y="${p.y - 11}" text-anchor="middle">${a.id}</text>`);
    });
    box.innerHTML = `<svg viewBox="0 0 ${GEO.W} ${GEO.H}" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

function renderTelemetry() {
    const tb = $('#telemetry-body');
    const d = state.dispatch;
    const rows = d ? d.telemetry : [];
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="6" class="muted">No telemetry yet.</td></tr>'; return; }
    tb.innerHTML = rows.map(r => {
        const pill = r.status === 'Completed' ? 'good' : r.status === 'PatientPicked' ? 'warn' : 'critical';
        return `<tr><td><b>${r.amb}</b></td><td>${r.time}</td><td>${r.lat}</td><td>${r.lng}</td><td>${r.speed}</td><td><span class="pill ${pill}">${r.status}</span></td></tr>`;
    }).join('');
}

function renderRequests() {
    const box = $('#requests-list');
    if (!box) return;
    const shown = state.requests.slice(-10).reverse();
    box.innerHTML = shown.map(r => {
        const cls = r.status.toLowerCase();
        return `<div class="req-item">
            <span class="r-id">${r.id}</span>
            <div style="flex:1"><div class="r-name">${r.name}</div>
            <div class="r-meta">${r.type} · ${r.severity} · ${r.support}${r.city ? ' · 📍 ' + r.city : ''}</div></div>
            <span class="r-status ${cls === 'pending' ? 'pending' : cls === 'assigned' ? 'assigned' : 'completed'}">${r.status.toUpperCase()}</span>
        </div>`;
    }).join('');
}

/* ---------- LIVE emergency requests ---------- */
function makeAutoRequest() {
    const types = Object.keys(EMERGENCY_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const sevRoll = Math.random();
    const sev = sevRoll < 0.15 ? 'Critical' : sevRoll < 0.45 ? 'High' : sevRoll < 0.80 ? 'Moderate' : 'Low';
    const city = CITY_LOCATIONS[Math.floor(Math.random() * CITY_LOCATIONS.length)];
    const spec = EMERGENCY_TYPES[type].spec;
    const support = spec + (sev === 'Critical' || sev === 'High' ? '+ALS' : '+BLS');
    state.requests.push({
        id: 'E' + (100 + state.requests.length + 5),
        name: pickName(), lat: city.lat, lng: city.lng, city: city.name,
        type, severity: sev, support, status: 'Pending', _age: 0,
    });
    if (state.requests.length > 40) state.requests.splice(0, state.requests.length - 40);
}

function tickRequests() {
    if (Math.random() < 0.7) makeAutoRequest();
    state.requests.forEach(r => { if (r.status !== 'Completed') r._age = (r._age || 0) + 1; });
    state.requests.forEach(r => {
        if (r.status === 'Pending' && r._age >= 2) r.status = 'Assigned';
        else if (r.status === 'Assigned' && r._age >= 7) r.status = 'Completed';
    });
    maybeAutoDispatch();
    renderRequests();
}

/* Auto-dispatch the next assigned CRITICAL request when the track is idle */
function maybeAutoDispatch() {
    const d = state.dispatch;
    if (d && d.phase !== 'done') return;
    const crit = state.requests.find(r => r.status === 'Assigned' && r.severity === 'Critical' && !r._dispatched);
    if (crit) {
        crit._dispatched = true;
        startDispatch({ id: crit.id, name: crit.name, patient: { lat: crit.lat, lng: crit.lng }, type: crit.type, severity: crit.severity, support: crit.support });
    }
}

function updateReqBtn() {
    const b = $('#btn-live-req');
    if (b) b.textContent = state.reqLive ? '⏸ Pause Live' : '▶ Resume Live';
    const dot = $('#req-live-dot');
    if (dot) dot.classList.toggle('on', state.reqLive);
}

function startReqLive() {
    stopReqLive();
    state.reqLive = true;
    state.reqTimer = setInterval(tickRequests, 4000);
    updateReqBtn();
}

function stopReqLive() {
    state.reqLive = false;
    if (state.reqTimer) { clearInterval(state.reqTimer); state.reqTimer = null; }
    updateReqBtn();
}

function renderFleet() {
    const box = $('#fleet-list');
    if (!box) return;
    box.innerHTML = AMBULANCES.map(a => `
        <div class="fleet-item">
            <span class="f-id">${a.id}</span>
            <span class="f-type ${a.type}">${a.type}</span>
            <div class="f-info">📍 ${a.lat.toFixed(4)}, ${a.lng.toFixed(4)} · ${a.equip.join(', ')}</div>
            <span class="f-status ${a.status === 'Available' ? 'avail' : a.status === 'Busy' ? 'busy' : 'maint'}">${a.status}</span>
        </div>`).join('');
}

function renderHospNetwork() {
    const box = $('#hosp-network-list');
    if (!box) return;
    const cities = [];
    HOSPITAL_NETWORK.forEach(h => {
        if (!cities.includes(h.city)) cities.push(h.city);
    });
    box.innerHTML = cities.map(city => `
        <div class="hnet-city">🏥 ${city} <span>${HOSPITAL_NETWORK.filter(h => h.city === city).length}</span></div>
        ${HOSPITAL_NETWORK.filter(h => h.city === city).map(h => `
        <div class="fleet-item">
            <span class="f-id">${h.id}</span>
            <div class="f-info"><b>${h.name}</b><br>ICU ${h.icu} · General ${h.general} · ${h.spec.join(', ')}</div>
            <div style="text-align:right">
                <div class="d-bar" style="width:70px;margin:0 0 5px auto"><span style="display:block;height:100%;border-radius:99px;width:${h.load}%;background:${h.load >= 85 ? 'var(--pink)' : h.load >= 65 ? 'var(--orange)' : 'var(--green)'}"></span></div>
                <span class="f-status ${h.load >= 85 ? 'busy' : h.load >= 65 ? 'maint' : 'avail'}">${h.load}% load</span>
            </div>
        </div>`).join('')}
    `).join('');
}

function renderAmbView() {
    renderDispatchDecision();
    if (ensureLeaflet()) updateLeafletMap();
    else renderTrackMap();
    renderTelemetry();
    renderRequests();
    renderFleet();
    renderHospNetwork();
}

/* ---------- Real interactive map (Leaflet + OSM), SVG fallback if offline ---------- */
function ensureLeaflet() {
    if (state.leaflet) return true;
    if (!window.L || !document.getElementById('track-map')) return false;
    try {
        const map = L.map('track-map', { center: [28.66, 77.455], zoom: 11, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        state.leaflet = map;
        state.leaflet.overlays = L.layerGroup().addTo(map);
        state.leaflet.hospFocus = null;
        const bounds = L.latLngBounds(HOSPITAL_NETWORK.map(h => [h.lat, h.lng]));
        map.fitBounds(bounds, { padding: [30, 30] });
        return true;
    } catch (e) { return false; }
}

function updateLeafletMap() {
    const Lmap = state.leaflet;
    if (!Lmap) return;
    state.leaflet.overlays.clearLayers();

    HOSPITAL_NETWORK.forEach(h => {
        state.leaflet.overlays.addLayer(L.circleMarker([h.lat, h.lng], {
            radius: 7, color: '#ff7a00', fillColor: '#ff7a00', fillOpacity: 0.9,
        }).bindPopup(`<b>🏥 ${h.id} ${h.name}</b><br>ICU ${h.icu} · General ${h.general} · Load ${h.load}%`));
    });

    AMBULANCES.forEach(a => {
        const col = a.status === 'Available' ? '#17b26a' : a.status === 'Busy' ? '#ff2e8b' : '#f79009';
        state.leaflet.overlays.addLayer(L.circleMarker([a.lat, a.lng], {
            radius: 6, color: col, fillColor: col, fillOpacity: 1,
        }).bindTooltip(`${a.id} (${a.type}) · ${a.status}`));
    });

    const d = state.dispatch;
    if (d) {
        const fullPts = d.path ? d.path.pts.map(p => [p.lat, p.lng])
            : [[d.start.lat, d.start.lng], [d.patient.lat, d.patient.lng], [d.hosp.lat, d.hosp.lng]];
        state.leaflet.overlays.addLayer(L.polyline(fullPts, { color: '#ffb0cd', weight: 2, dashArray: '6 5' }));

        let traveled = d.path
            ? d.path.pts.filter((p, i) => d.path.cum[i] <= d.adv).map(p => [p.lat, p.lng]).concat([[d.amb.lat, d.amb.lng]])
            : [[d.start.lat, d.start.lng], [d.amb.lat, d.amb.lng]];
        state.leaflet.overlays.addLayer(L.polyline(traveled, { color: '#ff2e8b', weight: 4 }));

        state.leaflet.overlays.addLayer(L.circleMarker([d.patient.lat, d.patient.lng], {
            radius: 8, color: '#e5484d', fillColor: '#e5484d', fillOpacity: 1,
        }).bindTooltip('PATIENT ' + d.req.name));
        state.leaflet.overlays.addLayer(L.marker([d.amb.lat, d.amb.lng], {
            icon: L.divIcon({ className: 'amb-divicon', html: '<span class="amb-pulse">🚑</span>', iconSize: [36, 36], iconAnchor: [18, 18] }),
        }).bindTooltip(d.amb.id));

        if (state.leaflet.hospFocus !== d.hosp.id) {
            state.leaflet.hospFocus = d.hosp.id;
            Lmap.flyTo([d.hosp.lat, d.hosp.lng], 12);
        }
    }
}

/* ---------- Location helpers (city list + live GPS detect) ---------- */
function nearestCity(lat, lng) {
    let best = null, bestD = Infinity;
    CITY_LOCATIONS.forEach(c => {
        const d = haversine(c, { lat, lng });
        if (d < bestD) { bestD = d; best = c; }
    });
    return best;
}

function populateCitySelect() {
    const sel = $('#dis-city');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select city or use live detect --</option>' +
        CITY_LOCATIONS.map(c => `<option value="${c.name}" data-lat="${c.lat}" data-lng="${c.lng}">${c.name}</option>`).join('');
}

function applyCityToForm() {
    const opt = $('#dis-city').options[$('#dis-city').selectedIndex];
    if (!opt || !opt.dataset.lat) return;
    $('#dis-lat').value = opt.dataset.lat;
    $('#dis-lng').value = opt.dataset.lng;
    $('#detect-status').textContent = '📍 Location set from: ' + opt.text;
}

function detectLiveLocation() {
    if (!navigator.geolocation) { toast('Geolocation not supported in this browser'); return; }
    $('#detect-status').textContent = '📡 Detecting your live location…';
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = +pos.coords.latitude.toFixed(4);
            const lng = +pos.coords.longitude.toFixed(4);
            $('#dis-lat').value = lat;
            $('#dis-lng').value = lng;
            const c = nearestCity(lat, lng);
            if (c) $('#dis-city').value = c.name;
            $('#detect-status').textContent = '📍 Live location locked: ' + (c ? c.name : lat + ', ' + lng) +
                ' (accuracy ±' + Math.round(pos.coords.accuracy) + 'm)';
            toast('Live location detected 📡');
        },
        err => {
            $('#detect-status').textContent = '⚠️ Could not detect: ' + (err.code === 1 ? 'permission denied' : err.message) + ' — pick a city below.';
            toast('Location access denied — select a city manually');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}

function pickName() { return NAMES[Math.floor(Math.random() * NAMES.length)]; }

/* Pick a department weighted by its current load (busier = more arrivals) */
function pickArrivalDept() {
    const total = DEPARTMENTS.reduce((s, d) => s + (AI.currentLoad(d) + 10), 0);
    let r = Math.random() * total;
    for (const d of DEPARTMENTS) {
        r -= (AI.currentLoad(d) + 10);
        if (r <= 0) return d;
    }
    return DEPARTMENTS[0];
}

function makeArrival() {
    const d = pickArrivalDept();
    const roll = Math.random();
    const triage = roll < 0.08 ? 'critical' : roll < 0.30 ? 'urgent' : roll < 0.70 ? 'moderate' : 'stable';
    state.arrivals.push({ time: new Date(), name: pickName(), deptId: d.id, triage });
    if (state.arrivals.length > 12) state.arrivals.shift();

    // bed pressure: admission + random discharge keeps it fluid
    if (d.kind === 'ward' && state.occupied[d.id] < d.beds) state.occupied[d.id]++;
    const ward = DEPARTMENTS.filter(x => x.kind === 'ward' && state.occupied[x.id] > 0);
    if (ward.length && Math.random() < 0.55) state.occupied[ward[Math.floor(Math.random() * ward.length)].id]--;
    state.trend[d.id] = clamp(state.trend[d.id] + rnd(-0.12, 0.18), -0.8, 0.8);
    return state.arrivals[state.arrivals.length - 1];
}

function renderTicker() {
    const box = $('#live-arrivals');
    if (!box) return;
    box.innerHTML = state.arrivals.slice().reverse().map(a => {
        const d = DEPARTMENTS.find(x => x.id === a.deptId);
        const t = new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<div class="arrival">
            <span class="a-time">${t}</span>
            <span class="a-name">${a.name}</span>
            <span class="a-dept">${d.icon} ${d.name}</span>
            <span class="a-tri triage-${a.triage}">${a.triage.toUpperCase()}</span>
        </div>`;
    }).join('');
    const c = $('#live-clock');
    if (c) c.textContent = '· ' + new Date().toLocaleTimeString();
}

function refreshActiveViews() {
    const id = $('.view.active') ? $('.view.active').id : '';
    if (id === 'view-predict') renderPrediction();
    else if (id === 'view-beds') renderBeds();
    else if (id === 'view-admin') renderAdmin();
}

function tickLive() {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) makeArrival();
    renderTicker();
    refreshActiveViews();
}

function startLive() {
    stopLive();
    state.live = true;
    state.liveTimer = setInterval(tickLive, 3000);
    const b = $('#btn-live-toggle');
    if (b) b.textContent = '⏸ Pause';
    const dot = $('#live-dot');
    if (dot) dot.classList.add('on');
}

function stopLive() {
    state.live = false;
    if (state.liveTimer) clearInterval(state.liveTimer);
    state.liveTimer = null;
    const b = $('#btn-live-toggle');
    if (b) b.textContent = '▶ Resume';
    const dot = $('#live-dot');
    if (dot) dot.classList.remove('on');
}

/* ---------- Renderers ---------- */

/* Feature tags in explainer card */
function renderFeatureTags() {
    const box = $('#feature-tags');
    box.innerHTML = '';
    AI.features.forEach((f, i) => {
        const chip = document.createElement('span');
        chip.className = 'chip' + (i < 2 ? ' hot' : '');
        chip.textContent = `${f.label}`;
        box.appendChild(chip);
    });
}

/* Explanation block for a prediction */
function renderExplanation(el, c, load) {
    const rows = AI.features.map(f => {
        const v = c[f.id].v;
        const pct = clamp((v / 30) * 100, -100, 100);
        const dir = v >= 0 ? 'pos' : 'neg';
        return `
            <div class="xpl-item">
                <span class="val">${f.label}</span>
                <div class="bar-track"><div class="bar ${dir}" style="width:${Math.abs(pct)}%"></div></div>
                <span style="width:52px;font-size:12px;color:${v>=0?'var(--pink-dark)':'#8a8292'}">${v>=0?'+':''}${Math.round(v)} pts</span>
            </div>`;
    }).join('');
    const total = Math.round(c.base.v + AI.features.reduce((s, f) => s + c[f.id].v, 0));
    el.innerHTML = `
        <div class="xpl-title">&#128161; Why the AI says ${load}%</div>
        ${rows}
        <div class="xpl-item" style="border-top:1px solid var(--border);padding-top:8px">
            <span class="val">Baseline + factors</span>
            <div class="bar-track"><div class="bar pos" style="width:${clamp(total/100*100,0,100)}%"></div></div>
            <span style="width:52px;font-size:12px;font-weight:700">${Math.round(total)} pts</span>
        </div>`;
}

/* Load chart (canvas) */
function drawLoadChart(dept, horizonSel) {
    const canvas = $('#load-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth || Math.min(window.innerWidth - 50, 900);
    const H = 220;
    ctx.clearRect(0, 0, W, H);

    const padL = 44, padB = 30, padT = 14, padR = 12;
    const pts = [];
    for (let h = 0; h <= 6; h++) pts.push(AI.predict(dept, h).load);

    // grid
    ctx.strokeStyle = '#f0e6ee';
    ctx.fillStyle = '#9a92a3';
    ctx.font = '11px Poppins';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padT + (H - padT - padB) * (i / 4);
        const val = 100 - i * 25;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillText(val + '%', 4, y + 4);
    }
    for (let i = 0; i <= 6; i++) {
        const x = padL + (W - padL - padR) * (i / 6);
        ctx.fillText('+' + i + 'h', x - 8, H - 8);
    }

    const xAt = i => padL + (W - padL - padR) * (i / 6);
    const yAt = v => padT + (H - padT - padB) * (1 - v / 100);

    // area + line with gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(255,46,139,0.25)');
    grad.addColorStop(1, 'rgba(255,122,0,0.02)');

    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(pts[0]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(xAt(i), yAt(pts[i]));
    ctx.lineTo(xAt(6), H - padB); ctx.lineTo(xAt(0), H - padB); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(pts[0]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(xAt(i), yAt(pts[i]));
    ctx.strokeStyle = 'var(--pink)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // highlight selected horizon
    const hi = parseInt(horizonSel || '4', 10);
    ctx.beginPath();
    ctx.arc(xAt(hi), yAt(pts[hi]), 6, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--orange)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.round(pts[hi]) + '%', xAt(hi) - 12, yAt(pts[hi]) - 12);
}

/* Prediction view */
function renderPrediction() {
    const deptId = $('#pred-dept').value;
    const horizon = parseInt($('#pred-horizon').value, 10);
    const d = DEPARTMENTS.find(x => x.id === deptId);

    $('#load-title').textContent = d.name;

    const p = AI.predict(d, horizon);
    const st = AI.statusOf(p.load);
    const conf = AI.confidence(horizon);

    $('#pred-load').querySelector('.big-load-num').textContent = p.load + '%';
    const bar = $('#pred-load-bar');
    bar.style.width = p.load + '%';
    bar.style.background = p.load >= 85 ? 'var(--pink)' : p.load >= 65 ? 'linear-gradient(90deg,var(--orange),var(--amber))' : 'linear-gradient(90deg,var(--green),var(--orange))';

    const chip = $('#pred-status');
    chip.textContent = st.text;
    chip.className = 'status-chip ' + st.cls;
    $('#pred-confidence').textContent = 'Confidence ' + conf + '%';

    renderExplanation($('#pred-explanation'), p.c, p.load);

    // wait
    const wait = AI.predictWait(d, horizon);
    $('#pred-wait .big-load-num').textContent = wait + ' min';
    const wbar = $('#pred-wait-bar');
    wbar.style.width = Math.min(100, (wait / 60) * 100) + '%';
    const wst = AI.statusOf(wait > 35 ? 80 : wait > 20 ? 68 : 40);
    const wchip = $('#pred-wait-status');
    wchip.textContent = wait > 35 ? 'Long wait — consider another dept' : wait > 20 ? 'Moderate wait' : 'Short wait';
    wchip.className = 'status-chip ' + wst.cls;
    $('#wait-explanation').innerHTML = `
        <div class="xpl-title">&#128161; Why the AI says ${wait} min</div>
        <div style="font-size:13px">Wait = base consult time (${d.waitBase} min) adjusted by predicted load of ${p.load}%.
        High load → longer queue → higher wait. Ask the voice assistant for a faster route.</div>`;

    drawLoadChart(d, $('#pred-horizon').value);
    renderAllDeptLoad();
}

/* All-dept load board (prediction view) */
function renderAllDeptLoad() {
    const box = $('#all-dept-load');
    box.innerHTML = '';
    DEPARTMENTS.forEach(d => {
        const p = AI.predict(d, 2);
        const st = AI.statusOf(p.load);
        const cell = document.createElement('div');
        cell.className = 'dept-load-cell';
        cell.style.borderColor = p.load >= 85 ? 'var(--pink)' : p.load >= 65 ? 'var(--orange)' : 'var(--border)';
        cell.innerHTML = `
            <div class="d-name">${d.icon} ${d.name}</div>
            <div class="d-bar"><span style="width:${p.load}%;background:${p.load>=85?'var(--pink)':p.load>=65?'var(--orange)':'var(--green)'}"></span></div>
            <div class="d-meta">${p.load}% predicted (2h) · ${st.text}</div>`;
        cell.style.cursor = 'pointer';
        cell.onclick = () => { $('#pred-dept').value = d.id; renderPrediction(); };
        box.appendChild(cell);
    });
}

/* ---------- BEDS VIEW ---------- */
function renderBeds() {
    let total = 0, free = 0, predicted = 0, critical = 0;
    const grid = $('#bed-grid');
    grid.innerHTML = '';

    DEPARTMENTS.filter(d => d.kind === 'ward').forEach(d => {
        const b = AI.predictBeds(d);
        total += d.beds; free += b.now; predicted += b.h4;
        if (AI.currentLoad(d) >= 85) critical++;

        const card = document.createElement('div');
        card.className = 'ward-card';
        card.style.borderColor = AI.currentLoad(d) >= 85 ? 'var(--pink)' : 'var(--border)';
        const dots = [];
        for (let i = 0; i < d.beds; i++) {
            dots.push(`<span class="bed-dot ${i < b.now ? 'free' : 'occ'}" title="${i < b.now ? 'Free' : 'Occupied'}"></span>`);
        }
        card.innerHTML = `
            <h4>${d.icon} ${d.name}</h4>
            <div class="ward-beds">${dots.join('')}</div>
            <div class="ward-meta"><b>${b.now}</b> free · <b>${b.h4}</b> free in 4h · load ${AI.currentLoad(d)}%</div>`;
        card.style.cursor = 'pointer';
        card.onclick = () => { $('#bed-ward').value = d.id; renderBedForecast(); };
        grid.appendChild(card);
    });

    $('#bed-total').textContent = total;
    $('#bed-free').textContent = free;
    $('#bed-predicted').textContent = predicted;
    $('#bed-critical').textContent = critical;

    renderBedForecast();
}

function renderBedForecast() {
    const d = DEPARTMENTS.find(x => x.id === $('#bed-ward').value);
    const b = AI.predictBeds(d);
    $('#bed-now').textContent = b.now;
    $('#bed-2h').textContent = b.h2;
    $('#bed-4h').textContent = b.h4;
    const delta = b.h4 - b.now;
    $('#bed-explanation').innerHTML = `
        <div class="xpl-title">&#128161; Why the AI predicts ${b.h4} free in 4h</div>
        <div style="font-size:13px">${d.name} currently has ${b.now} free beds. Based on ${AI.predict(d,4).load}% predicted load,
        occupancy is expected to ${delta > 0 ? 'free up by' : delta < 0 ? 'fill up by' : 'stay around'} ${Math.abs(delta)} bed(s).
        ${delta < 0 ? '<b>Tip:</b> consider an alternate ward for non-critical admissions.' : ''}</div>`;
}

/* ---------- SMART ROUTING (multi-floor) ---------- */
const floorLabel = l => ['Ground (L1)', '1st Floor (L2)', '2nd Floor (L3)'][l - 1] || ('Level ' + l);

function renderRouting() {
    const reason = $('#route-reason').value;
    const severity = $('#route-severity').value;
    const wantBed = $('#route-bed').value;
    const out = $('#route-result');
    out.classList.remove('empty');

    if (!reason) {
        out.className = 'route-result empty';
        out.innerHTML = '<p class="muted">Select a reason &amp; severity, then hit "Optimize My Route".</p>';
        return;
    }

    let candidates = ROUTING[reason].map(id => DEPARTMENTS.find(d => d.id === id));
    if (wantBed === 'yes') candidates = candidates.filter(d => d.kind === 'ward');
    if (!candidates.length) candidates = [DEPARTMENTS.find(d => d.id === 'general')];

    // score: lower predicted load + lower wait = better (small penalty for higher floors)
    let best = null, bestScore = Infinity;
    candidates.forEach(d => {
        const loc = DEPT_LOC[d.id] || { level: 2, node: 'opd' };
        const load = AI.predict(d, 1).load;
        const wait = AI.predictWait(d, 1);
        const score = load * 0.6 + wait * 1.2 + (loc.level - 1) * 3;
        if (score < bestScore) { bestScore = score; best = { d, loc, load, wait, score }; }
    });

    // multi-floor route plan: L1 reception -> elevator -> dept floor -> dept node
    const plan = buildRoutePlan(best.loc);
    drawRoutePlan(plan);

    // steps
    const steps = [];
    const step = (n, html) => `<div class="route-step"><span class="num">${n}</span>${html}</div>`;
    let n = 0;
    let routeNames = [];
    plan.forEach(seg => {
        if (seg.type === 'elevator') {
            steps.push(step(++n, `Take elevator / stairs to <b>${floorLabel(seg.to)}</b>`));
        } else {
            const names = seg.path.map(id => FLOORS[seg.level].nodes[id].name);
            routeNames = routeNames.concat(names.slice(0, -1).length ? names : names);
            for (let i = 0; i < seg.path.length - 1; i++) {
                steps.push(step(++n, `Walk from <b>${names[i]}</b> to <b>${names[i + 1]}</b>`));
            }
        }
    });

    const st = AI.statusOf(best.load);
    out.innerHTML = `
        <div class="route-rec">
            <div class="rec-icon">🎯</div>
            <div>
                <h4>${best.d.icon} ${best.d.name} — your best match</h4>
                <p>${floorLabel(best.loc.level)} · Predicted load ${best.load}% (${st.text}) · Est. wait <b>${best.wait} min</b></p>
            </div>
        </div>
        <div class="route-steps">${steps.join('')}</div>
        <div class="xpl" style="margin-top:10px">
            <div class="xpl-title">&#128161; Why this route?</div>
            <div style="font-size:13px">MediFast scored every matching department by predicted load, waiting time &amp; floor distance.
            <b>${best.d.name}</b> scored best (${Math.round(best.score)}). The map above auto-switched to <b>${floorLabel(best.loc.level)}</b>.
            Voice: "navigate me to ${best.d.name}".</div>
        </div>`;
    $('#route-voice-hint').textContent = `Try voice: "navigate me to ${best.d.name}"`;
}

/* Build a plan: [ {type:'walk',level,path}, {type:'elevator',to}, ... ] */
function buildRoutePlan(loc) {
    const plan = [];
    if (loc.level === 1) {
        plan.push({ type: 'walk', level: 1, path: findPath(1, 'recep', loc.node) });
    } else {
        plan.push({ type: 'walk', level: 1, path: findPath(1, 'recep', 'elev') });
        plan.push({ type: 'elevator', from: 1, to: loc.level });
        plan.push({ type: 'walk', level: loc.level, path: findPath(loc.level, 'elev', loc.node) });
    }
    return plan;
}

/* BFS path within a single floor graph */
function findPath(level, from, to) {
    const paths = FLOORS[level].paths;
    if (from === to) return [from];
    const q = [[from]];
    const seen = new Set([from]);
    while (q.length) {
        const path = q.shift();
        const cur = path[path.length - 1];
        for (const x of (paths[cur] || [])) {
            if (seen.has(x)) continue;
            seen.add(x);
            const np = [...path, x];
            if (x === to) return np;
            q.push(np);
        }
    }
    return [from, to];
}

/* ================= 3D HOSPITAL BUILDING ================= */
const DECK_SIZE = 300;      // floor deck size (px)
const FLOOR_GAP = 92;       // vertical gap between floors (px)

function build3DScene() {
    const scene = $('#scene3d');
    scene.innerHTML = '';
    scene.style.setProperty('--ry', (state.ry || 45) + 'deg');

    Object.entries(FLOORS).forEach(([lv, floor]) => {
        const deck = document.createElement('div');
        deck.className = 'deck' + (parseInt(lv, 10) === state.floor ? ' active' : '');
        deck.dataset.level = lv;
        deck.style.transform = `translate(-50%, -50%) translateZ(${(lv - 1) * FLOOR_GAP}px)`;

        const top = document.createElement('div');
        top.className = 'd-top';
        top.innerHTML = `<span class="d-name3d">${floor.name}</span>`;
        deck.appendChild(top);

        const front = document.createElement('div');
        front.className = 'd-front';
        deck.appendChild(front);

        const side = document.createElement('div');
        side.className = 'd-side';
        deck.appendChild(side);

        Object.entries(floor.nodes).forEach(([id, nd]) => {
            const node = document.createElement('div');
            node.className = 'node3d' + (id === 'elev' ? ' elev' : '');
            node.dataset.node = id;
            node.style.left = nd.x + '%';
            node.style.top = nd.y + '%';
            node.innerHTML = `<div class="n-top">${id === 'elev' ? '🛗 ' : ''}${nd.name}</div><div class="n-front"></div><div class="n-side"></div>`;
            deck.appendChild(node);
        });

        const bars = document.createElement('div');
        bars.className = 'route-bars';
        deck.appendChild(bars);

        scene.appendChild(deck);
    });
}

/* Render a floor's 3D scene + highlight route on it */
function renderFloorMap(level) {
    state.floor = level;
    $('#floor-title').textContent = FLOORS[level].name;
    $$('.floor-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.floor, 10) === level));
    build3DScene();
    drawRouteForFloor(level);
}

/* Draw the stored route plan's segment on a given floor */
function drawRouteForFloor(level) {
    if (!state.routePlan) return;
    const seg = state.routePlan.find(s => s.type === 'walk' && s.level === level);
    const deck = $(`.deck[data-level="${level}"]`);
    if (!seg || !deck) return;

    const bars = deck.querySelector('.route-bars');
    const path = seg.path;
    for (let i = 0; i < path.length - 1; i++) {
        const a = FLOORS[level].nodes[path[i]], b = FLOORS[level].nodes[path[i + 1]];
        if (!a || !b) continue;
        const x1 = (a.x / 100) * DECK_SIZE, y1 = (a.y / 100) * DECK_SIZE;
        const x2 = (b.x / 100) * DECK_SIZE, y2 = (b.y / 100) * DECK_SIZE;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const bar = document.createElement('div');
        bar.className = 'route-bar';
        bar.style.left = x1 + 'px';
        bar.style.top = y1 + 'px';
        bar.style.width = len + 'px';
        bar.style.transform = 'rotate(' + ang + 'deg)';
        bars.appendChild(bar);
    }

    deck.querySelectorAll('.node3d').forEach(n => n.classList.remove('target', 'waypoint'));
    path.forEach((nid, i) => {
        const el = deck.querySelector(`.node3d[data-node="${nid}"]`);
        if (!el) return;
        if (nid === path[path.length - 1]) el.classList.add('target');
        else if (i > 0) el.classList.add('waypoint');
    });
    if (level > 1) { const el = deck.querySelector('.node3d.elev'); if (el) el.classList.add('waypoint'); }
}

/* Highlight a route plan: switch to dest floor, store, draw */
function drawRoutePlan(plan) {
    state.routePlan = plan;
    const dest = plan[plan.length - 1];
    const destLevel = dest.type === 'walk' ? dest.level : 1;
    renderFloorMap(destLevel);
}

/* Drag-to-rotate + rotate buttons */
function init3DControls() {
    const el = $('#map3d');
    if (!el) return;
    let dragging = false, startX = 0, startRy = 0;
    el.addEventListener('pointerdown', e => {
        dragging = true;
        startX = e.clientX;
        startRy = state.ry || 45;
        el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
        if (!dragging) return;
        state.ry = startRy + (e.clientX - startX) * 0.5;
        $('#scene3d').style.setProperty('--ry', state.ry + 'deg');
    });
    const end = () => { dragging = false; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    $('#rot-l').addEventListener('click', () => { state.ry = (state.ry || 45) - 15; $('#scene3d').style.setProperty('--ry', state.ry + 'deg'); });
    $('#rot-r').addEventListener('click', () => { state.ry = (state.ry || 45) + 15; $('#scene3d').style.setProperty('--ry', state.ry + 'deg'); });
}

/* ---------- EMERGENCY ---------- */
function renderEmergencyQueue() {
    const box = $('#emergency-queue');
    if (!state.emQueue.length) {
        box.innerHTML = '<p class="muted">No patients in the AI triage queue yet. Add one to see priority flow.</p>';
        return;
    }
    // sort by severity then arrival
    const order = { critical: 0, urgent: 1, moderate: 2, stable: 3 };
    const sorted = [...state.emQueue].sort((a, b) => order[a.triage] - order[b.triage] || a.at - b.at);
    box.innerHTML = sorted.map((p, i) => {
        const cls = 'triage-' + p.triage;
        const pri = order[p.triage] + 1;
        const wait = AI.predictWait(DEPARTMENTS.find(d => d.id === 'emergency'), 0) * (1 + order[p.triage] * 0.3);
        return `
            <div class="queue-item">
                <span class="triage-badge ${cls}">${p.triage.toUpperCase()}</span>
                <div class="q-info">
                    <div class="q-name">${p.name || 'Patient'}</div>
                    <div class="q-meta">${p.symptoms || 'No symptoms noted'} · added ${new Date(p.at).toLocaleTimeString()}</div>
                </div>
                <div class="q-priority p${pri}">P${pri} · ~${Math.round(wait)} min</div>
            </div>`;
    }).join('');
}

/* ---------- ADMIN ---------- */
function renderAdmin() {
    const alerts = $('#admin-alerts');
    const actions = $('#admin-actions');
    const tbody = $('#admin-table');
    alerts.innerHTML = ''; actions.innerHTML = '';
    let alertCount = 0, overload = 0, critical = 0, hints = 0;

    DEPARTMENTS.forEach(d => {
        const p = AI.predict(d, 4);
        const st = AI.statusOf(p.load);
        const now = AI.currentLoad(d);
        if (p.load >= 85) critical++;
        if (p.load >= 65) overload++;

        // table row
        const pill = p.load >= 85 ? 'critical' : p.load >= 65 ? 'warn' : 'good';
        tbody.innerHTML += `
            <tr>
                <td>${d.icon} ${d.name}</td>
                <td>${now}%</td>
                <td>${d.beds ? AI.predictBeds(d).now : '—'}</td>
                <td>${p.load}%</td>
                <td>${AI.predictWait(d, 1)} min</td>
                <td><span class="pill ${pill}">${st.text}</span></td>
            </tr>`;

        // alerts
        if (p.load >= 85) {
            alertCount++;
            alerts.innerHTML += `
                <div class="alert-item critical">
                    <div>🚨</div>
                    <div><div class="a-title">${d.name} predicted CRITICAL (${p.load}%) in 4h</div>
                    <div class="a-body">Occupancy is forecast to exceed 85%. Consider opening surge beds, adding staff, and diverting non-critical patients.</div></div>
                </div>`;
            hints++;
            actions.innerHTML += `
                <div class="action-item"><div class="a-icon">🧑‍⚕️</div>
                <div><div class="a-title">Add ${Math.ceil(d.staff * 0.25)} staff to ${d.name}</div>
                <div class="a-body">AI predicts staffing is short for the expected load. Deploy float staff within 2 hours.</div></div></div>`;
        } else if (p.load >= 65) {
            alertCount++;
            alerts.innerHTML += `
                <div class="alert-item warn">
                    <div>⚠️</div>
                    <div><div class="a-title">${d.name} load rising (${p.load}%)</div>
                    <div class="a-body">Monitor closely. Increase triage staffing and keep OPD flow steady to avoid a spike.</div></div>
                </div>`;
        } else {
            alerts.innerHTML += `
                <div class="alert-item info">
                    <div>✅</div>
                    <div><div class="a-title">${d.name} healthy (${p.load}%)</div>
                    <div class="a-body">No action needed. Capacity comfortable for the forecast window.</div></div>
                </div>`;
        }
    });

    if (!alerts.children.length) alerts.innerHTML = '<p class="muted">No alerts.</p>';
    if (!actions.children.length) actions.innerHTML = '<p class="muted">No recommended actions — all clear.</p>';

    $('#adm-alert-count').textContent = alertCount;
    $('#adm-overload').textContent = overload;
    $('#adm-critical').textContent = critical;
    $('#adm-staff').textContent = hints;
}

/* ---------- NAVIGATION ---------- */
/* ---------- BLOOD BANK (relational: BLOOD_BANKS + BLOOD_STOCK) ---------- */
function bankById(id) { return state.blood.find(b => b.blood_bank_id === id); }
function activeBanks() { return state.blood.filter(b => b.status === 'Active'); }
function unitsAt(bankId, group) {
    return state.bloodStock
        .filter(s => s.blood_bank_id === bankId && s.blood_group === group)
        .reduce((t, s) => t + s.units_available, 0);
}
function bankTotal(b) { return BLOOD_GROUPS.reduce((t, g) => t + unitsAt(b.blood_bank_id, g), 0); }
function bloodLogPush(action, bankId, group, units, detail) {
    state.bloodLog.unshift({ time: new Date().toLocaleTimeString(), action, bankId, group, units, detail });
    state.bloodLog = state.bloodLog.slice(0, 12);
}

function fillBloodSelects() {
    ['bb-group', 'br-group', 'donor-group'].forEach(id => {
        const sel = $('#' + id);
        if (sel) sel.innerHTML = BLOOD_GROUPS.map(g => `<option value="${g}">${g}</option>`).join('');
    });
    const bbCity = $('#bb-city');
    if (bbCity) bbCity.innerHTML = '<option value="">-- Select city --</option>'
        + CITY_LOCATIONS.map(c => `<option value="${c.name}" data-lat="${c.lat}" data-lng="${c.lng}">${c.name}</option>`).join('');
    const dc = $('#donor-city');
    if (dc) dc.innerHTML = '<option value="">-- City --</option>' + CITY_LOCATIONS.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const db = $('#donor-bank');
    if (db) db.innerHTML = '<option value="">-- Select blood bank --</option>'
        + BLOOD_BANKS.filter(b => b.status === 'Active').map(b => `<option value="${b.blood_bank_id}">${b.name} (${b.city})</option>`).join('');
    const bh = $('#br-hospital');
    if (bh) bh.innerHTML = '<option value="">-- Select hospital --</option>'
        + HOSPITAL_NETWORK.map(h => `<option value="${h.id}" data-lat="${h.lat}" data-lng="${h.lng}">${h.id} ${h.name}</option>`).join('');
}

function renderBloodStock() {
    const body = $('#bb-stock-body');
    if (!body) return;
    body.innerHTML = state.blood.map(b => `
        <tr>
            <td><b>${b.name}</b>${b.status !== 'Active' ? ` <span class="f-status maint">${b.status}</span>` : ''}</td>
            <td>${b.city}</td>
            ${BLOOD_GROUPS.map(g => {
                const u = unitsAt(b.blood_bank_id, g);
                return `<td class="${u <= 2 ? 'bb-low' : u <= 4 ? 'bb-mid' : 'bb-ok'}">${u}</td>`;
            }).join('')}
            <td><b>${bankTotal(b)}</b></td>
        </tr>`).join('');
}

function renderBloodSearch() {
    const g = $('#bb-group').value;
    const box = $('#bb-results');
    if (!box) return;
    const list = activeBanks().slice().sort((a, b) => unitsAt(b.blood_bank_id, g) - unitsAt(a.blood_bank_id, g));
    const totalUnits = list.reduce((s, b) => s + unitsAt(b.blood_bank_id, g), 0);
    box.className = 'route-result';
    box.innerHTML = `<div class="xpl-title">Found ${totalUnits} units of ${g} across ${list.length} active blood banks</div>`
        + (list.length
            ? list.map((b, i) => {
                const u = unitsAt(b.blood_bank_id, g);
                return `<div class="fleet-item" style="margin-top:6px">
                    <span class="f-id">#${i + 1}</span>
                    <div class="f-info"><b>${b.name}</b><br>${b.city} · ${b.contact}</div>
                    <div style="text-align:right">
                        <span class="f-status ${u <= 2 ? 'busy' : u <= 4 ? 'maint' : 'avail'}">${u} units</span>
                    </div>
                </div>`;
            }).join('')
            : '<p class="muted" style="margin-top:8px">No active blood banks found.</p>');
}

function renderDonors() {
    const list = $('#donor-list');
    if (!list) return;
    const count = $('#donor-count');
    if (count) count.textContent = state.donors.length + ' donors';
    list.innerHTML = state.donors.map(d => {
        const b = bankById(d.bank);
        return `<div class="fleet-item">
            <span class="f-id">${d.group}</span>
            <div class="f-info"><b>${d.name}</b><br>${d.age} yrs · ${d.city} · last ${d.donated}</div>
            <div style="text-align:right"><span class="f-status avail">${b ? b.blood_bank_id : d.phone}</span></div>
        </div>`;
    }).join('');
}

function renderBloodFeed() {
    const box = $('#bb-feed');
    if (!box) return;
    box.innerHTML = state.bloodFeed.slice(0, 8).map(e => `
        <div class="fleet-item">
            <span class="f-id">${e.group}</span>
            <div class="f-info"><b>${e.donor} donated ${e.units} unit${e.units > 1 ? 's' : ''} ${e.group}</b><br>${e.bank} · ${e.time}</div>
        </div>`).join('');
}

function renderBloodTrack() {
    const box = $('#bb-track-log');
    if (!box) return;
    box.innerHTML = (state.bloodLog.length ? state.bloodLog : []).map(l => {
        const b = bankById(l.bankId);
        return `<div class="fleet-item">
            <span class="f-id">${l.group}</span>
            <div class="f-info"><b>${l.action} · ${l.units} unit${l.units > 1 ? 's' : ''} ${l.group}</b><br>${b ? b.name : ''}${l.detail ? ' · ' + l.detail : ''}</div>
            <div style="text-align:right"><span class="f-status avail">${l.time}</span></div>
        </div>`;
    }).join('') || '<p class="muted">Waiting for live unit movement…</p>';
}

function renderBloodAlerts() {
    const box = $('#bb-alerts');
    if (!box) return;
    const alerts = [];
    activeBanks().forEach(b => {
        BLOOD_GROUPS.forEach(g => {
            const u = unitsAt(b.blood_bank_id, g);
            if (u <= 2) alerts.push({ b, g, u, cls: u === 0 ? 'critical' : 'warn' });
        });
    });
    alerts.sort((a, b) => a.u - b.u);
    box.innerHTML = alerts.length
        ? alerts.slice(0, 8).map(a => `<div class="alert-item ${a.cls}" style="margin-bottom:8px">
            <div>&#128308;</div>
            <div><div class="a-title">${a.g} LOW STOCK — ${a.b.name}</div>
            <div class="a-body">Only ${a.u} unit${a.u === 1 ? '' : 's'} left · ${a.b.contact}</div></div>
        </div>`).join('')
        : '<p class="muted">No low-stock alerts. All active banks stocked. ✅</p>';
}

function liveBloodTick() {
    state.bloodFeed = state.bloodFeed.slice(0, 8);
    const roll = Math.random();
    const banks = activeBanks();
    if (roll < 0.5 && banks.length) {
        const donor = state.donors[Math.floor(Math.random() * state.donors.length)];
        const bank = banks[Math.floor(Math.random() * banks.length)];
        const g = donor ? donor.group : BLOOD_GROUPS[Math.floor(Math.random() * BLOOD_GROUPS.length)];
        const batch = state.bloodStock.find(s => s.blood_bank_id === bank.blood_bank_id && s.blood_group === g);
        if (batch) batch.units_available += 1;
        state.bloodFeed.unshift({ donor: donor ? donor.name : 'Volunteer', group: g, units: 1, bank: bank.name, time: 'just now' });
        bloodLogPush('Donation received', bank.blood_bank_id, g, 1, donor ? donor.name : 'volunteer');
    } else if (roll < 0.78 && banks.length) {
        const bank = banks[Math.floor(Math.random() * banks.length)];
        const g = BLOOD_GROUPS[Math.floor(Math.random() * BLOOD_GROUPS.length)];
        const batch = state.bloodStock.find(s => s.blood_bank_id === bank.blood_bank_id && s.blood_group === g);
        if (batch && batch.units_available > 0) {
            batch.units_available -= 1;
            bloodLogPush(Math.random() < 0.5 ? 'Issued to patient' : 'Expired', bank.blood_bank_id, g, 1, '');
        }
    }
    if ($('#view-bloodbank').classList.contains('active')) renderBloodBank();
}

function renderBloodBank() {
    renderBloodStock();
    renderBloodSearch();
    renderDonors();
    renderBloodFeed();
    renderBloodTrack();
    renderBloodAlerts();
    if (ensureBBMap()) renderBBMap();
}

/* ---- Nearest blood bank finder ---- */
function findNearestBanks(lat, lng) {
    return activeBanks().slice().sort((a, b) => haversine(a, { lat, lng }) - haversine(b, { lat, lng }));
}

function renderNearestFinder(lat, lng, byDetect) {
    const box = $('#bb-finder-result');
    if (!box) return;
    const near = findNearestBanks(lat, lng);
    const top = near.slice(0, 3);
    box.className = 'route-result';
    box.innerHTML = `<div class="xpl-title">${byDetect ? '📡' : '📌'} Nearest blood banks to ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>`
        + top.map((b, i) => {
            const dist = haversine(b, { lat, lng });
            return `<div class="fleet-item" style="margin-top:6px">
                <span class="f-id">${i === 0 ? '⭐' : '#' + (i + 1)}</span>
                <div class="f-info"><b>${b.name}</b><br>${b.city} · ${dist.toFixed(1)} km · ${b.contact}</div>
                <div style="text-align:right"><span class="f-status ${i === 0 ? 'avail' : 'maint'}">${b.status}</span></div>
            </div>`;
        }).join('');
    if (near[0]) {
        fetchRoute({ lat, lng }, near[0]).then(r => {
            const d1 = $('.xpl-title', box);
            if (d1 && r) d1.textContent = '🛣️ Driving distance to ' + near[0].name + ': ' + (r.distM / 1000).toFixed(1) + ' km · ~' + Math.max(1, Math.round(r.durS / 60)) + ' min';
        });
    }
    state.bbFind = { lat, lng };
    renderBBMap();
}

/* ---- Blood bank Leaflet map ---- */
function ensureBBMap() {
    if (state.bbMap) return true;
    if (!window.L || !document.getElementById('bb-map')) return false;
    try {
        const map = L.map('bb-map', { center: [28.55, 77.30], zoom: 10, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        state.bbMap = map;
        state.bbLayers = L.layerGroup().addTo(map);
        const bounds = L.latLngBounds(BLOOD_BANKS.map(b => [b.lat, b.lng]));
        map.fitBounds(bounds, { padding: [25, 25] });
        return true;
    } catch (e) { return false; }
}

function renderBBMap() {
    const map = state.bbMap;
    if (!map) return;
    state.bbLayers.clearLayers();
    state.blood.forEach(b => {
        const total = bankTotal(b);
        const col = b.status !== 'Active' ? '#9aa0a6' : total <= 25 ? '#ff2e8b' : '#ff7a00';
        state.bbLayers.addLayer(L.circleMarker([b.lat, b.lng], {
            radius: b.status === 'Active' ? 8 : 6, color: col, fillColor: col, fillOpacity: 0.85,
        }).bindPopup(`<b>🩸 ${b.name}</b><br>${b.city} · ${b.contact}<br>Status: <b>${b.status}</b> · Total: <b>${total} units</b>`));
    });
    if (state.bbFind) {
        const { lat, lng } = state.bbFind;
        state.bbLayers.addLayer(L.circleMarker([lat, lng], {
            radius: 9, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.9,
        }).bindTooltip('📌 Your location'));
        const near = findNearestBanks(lat, lng);
        if (near[0]) state.bbLayers.addLayer(L.polyline([[lat, lng], [near[0].lat, near[0].lng]], { color: '#ff2e8b', weight: 3, dashArray: '6 4' }));
    }
}

function addDonor(e) {
    e.preventDefault();
    const name = $('#donor-name').value.trim();
    const age = parseInt($('#donor-age').value, 10);
    const group = $('#donor-group').value;
    const city = $('#donor-city').value;
    const bank = $('#donor-bank').value;
    const phone = $('#donor-phone').value.trim() || '+91 ----------';
    if (!name || !city) { toast('Name and city are required'); return; }
    state.donors.unshift({ id: 'D' + (100 + state.donors.length + 1), name, age, group, city, bank, phone, donated: 'just registered' });
    if (bank) {
        const batch = state.bloodStock.find(s => s.blood_bank_id === bank && s.blood_group === group);
        if (batch) { batch.units_available += 1; bloodLogPush('Donation received', bank, group, 1, name); }
    }
    $('#donor-form').reset();
    toast('Donor registered 🩸 ' + group);
    renderBloodBank();
}

function requestBlood(e) {
    e.preventDefault();
    const name = $('#br-name').value.trim();
    const group = $('#br-group').value;
    const units = parseInt($('#br-units').value, 10) || 1;
    const urgency = $('#br-urgency').value;
    const hOpt = $('#br-hospital');
    const hosp = hOpt.selectedIndex > 0 ? HOSPITAL_NETWORK.find(h => h.id === hOpt.value) : null;
    if (!name) { toast('Enter patient name'); return; }
    const ref = hosp ? { lat: hosp.lat, lng: hosp.lng } : null;
    const candidates = activeBanks().slice();
    if (ref) candidates.sort((a, b) => haversine(a, ref) - haversine(b, ref));
    const available = candidates.filter(b => unitsAt(b.blood_bank_id, group) >= units);
    const enough = available.length > 0;
    const box = $('#br-result');
    const scope = ref ? 'to ' + hosp.name : 'across NCR';
    box.className = 'route-result';
    box.innerHTML = `<div class="route-rec">
        <div class="rec-icon">&#128137;</div>
        <div><h4>${name} — ${units} unit${units > 1 ? 's' : ''} of ${group}</h4><p>${urgency} · ${enough ? 'Stock located ' + scope : 'LOW STOCK — alert + donor drive raised'}</p></div>
    </div>`
        + (enough
            ? available.slice(0, 3).map(m => {
                const dist = ref ? haversine(m, ref).toFixed(1) + ' km' : '';
                return `<div class="fleet-item" style="margin-top:6px">
                    <span class="f-id">${unitsAt(m.blood_bank_id, group)}u</span>
                    <div class="f-info"><b>${m.name}</b><br>${m.city} · ${m.contact} ${dist}</div>
                    <div style="text-align:right"><span class="f-status avail">Ready &#10003;</span></div>
                </div>`;
            }).join('')
            : `<div class="alert-item critical"><div>&#9888;&#65039;</div><div><div class="a-title">Low Stock Alert</div><div class="a-body">Only ${state.blood.reduce((s, b) => s + unitsAt(b.blood_bank_id, group), 0)} units of ${group} left across NCR. Contacting ${group} donors via SMS…</div></div></div>`);
    if (hosp) {
        const nearest = findNearestBanks(hosp.lat, hosp.lng);
        if (nearest[0]) {
            const detail = '🏥 ' + hosp.id + ' ' + hosp.name + ' requests ' + units + ' unit(s) ' + group
                + (enough ? ' — units dispatched' : ' — TRANSFER NEEDED');
            bloodLogPush(enough ? 'Dispatched to hospital' : 'Transfer requested', nearest[0].blood_bank_id, group, units, hosp.name);
            if (!enough || urgency === 'Critical') {
                box.innerHTML += `<div class="alert-item ${enough ? 'info' : 'critical'}" style="margin-top:8px">
                    <div>&#128680;</div>
                    <div><div class="a-title">Hospital-to-Blood-Bank Alert</div>
                    <div class="a-body">${detail} · Nearest bank: <b>${nearest[0].name}</b> (${haversine(nearest[0], hosp).toFixed(1)} km) — ${nearest[0].contact}</div></div>
                </div>`;
            }
        }
    }
    if (urgency === 'Critical' && !enough) {
        const donors = state.donors.filter(d => d.group === group);
        toast('🚨 Contacting ' + (donors.length || 'all nearby') + ' ' + group + ' donor' + (donors.length === 1 ? '' : 's') + ' now');
    } else if (enough) {
        toast('✅ ' + units + ' units of ' + group + ' located');
    } else {
        toast('⚠️ Low stock alert raised for ' + group);
    }
    renderBloodTrack();
    renderBloodAlerts();
}

function setupNav() {
    $$('.nav a').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const view = a.dataset.view;
            $$('.nav a').forEach(x => x.classList.remove('active'));
            a.classList.add('active');
            $$('.view').forEach(v => v.classList.remove('active'));
            $('#view-' + view).classList.add('active');
            if (view === 'predict') renderPrediction();
            if (view === 'beds') renderBeds();
            if (view === 'route') renderFloorMap(state.floor || 1);
            if (view === 'emergency') renderEmergencyQueue();
            if (view === 'ambulance') {
                if (ensureLeaflet()) setTimeout(() => { if (state.leaflet) state.leaflet.invalidateSize(); }, 120);
                renderAmbView();
            }
            if (view === 'hospitals') renderHospitals();
            if (view === 'bloodbank') {
                if (ensureBBMap()) setTimeout(() => { if (state.bbMap) state.bbMap.invalidateSize(); }, 120);
                renderBloodBank();
            }
            if (view === 'admin') renderAdmin();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
    $$('[data-goto]').forEach(b => {
        b.addEventListener('click', () => {
            const view = b.dataset.goto;
            const navLink = $(`.nav a[data-view="${view}"]`);
            if (navLink) navLink.click();
        });
    });
}

/* ---------- VOICE ASSISTANT ---------- */
let recognition = null;
const synth = window.speechSynthesis;

function speak(text) {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.lang === 'hi-IN' ? 'hi-IN' : 'en-IN';
    u.rate = 1;
    synth.speak(u);
}

function langLabel() { return state.lang === 'hi-IN' ? 'Hindi' : 'English'; }

function addChat(q, a) {
    const body = $('#voice-body');
    body.innerHTML += `<div class="q">🗣️ ${q}</div><div class="a">🤖 ${a}</div>`;
    body.scrollTop = body.scrollHeight;
}

/* Natural-language query handling */
function answerQuery(raw) {
    const q = raw.toLowerCase();
    let reply, say;

    const dept = DEPARTMENTS.find(d => q.includes(d.name.toLowerCase()) || (q.includes('emergency') && d.id === 'emergency'));

    if (q.includes('bed') || q.includes('बिस्तर')) {
        if (dept) {
            const b = AI.predictBeds(dept);
            reply = `In ${dept.name}, ${b.now} beds are free now, predicted ${b.h4} free in 4 hours.`;
            say = state.lang === 'hi-IN'
                ? HI.beds_dept.replace('{dept}', dept.name).replace('{free}', b.now) + ` चार घंटे में ${b.h4} खाली होंगे।`
                : reply;
        } else {
            const total = DEPARTMENTS.filter(d => d.kind === 'ward').reduce((s, d) => s + AI.predictBeds(d).now, 0);
            reply = `Right now ${total} beds are free across the hospital.`;
            say = state.lang === 'hi-IN' ? HI.beds.replace('{free}', total) : reply;
        }
    } else if (q.includes('wait') || q.includes('प्रतीक्षा') || q.includes('time')) {
        const d = dept || DEPARTMENTS.find(x => x.id === 'emergency');
        const w = AI.predictWait(d, 0);
        reply = `Estimated waiting time in ${d.name} is about ${w} minutes.`;
        say = state.lang === 'hi-IN' ? HI.wait.replace('{dept}', d.name).replace('{wait}', w) : reply;
    } else if (q.includes('overcrowd') || q.includes('load') || q.includes('भीड़') || q.includes('crowd')) {
        const d = dept || DEPARTMENTS.find(x => x.id === 'emergency');
        const p = AI.predict(d, 2);
        const st = AI.statusOf(p.load);
        const stLabel = state.lang === 'hi-IN'
            ? (p.load >= 85 ? HI.status_critical : p.load >= 65 ? HI.status_warn : HI.status_good)
            : st.text;
        reply = `${d.name} load is predicted at ${p.load} percent. Status: ${st.text}.`;
        say = state.lang === 'hi-IN'
            ? HI.load.replace('{dept}', d.name).replace('{load}', p.load).replace('{status}', stLabel)
            : reply + (p.load >= 85 ? ' Please consider an alternate department.' : '');
    } else if (q.includes('route') || q.includes('navigate') || q.includes('रास्ता') || q.includes('direction')) {
        const d = dept || DEPARTMENTS.find(x => x.id === 'opd');
        reply = `Best match for you is ${d.name}. Start at Reception and follow the pink path.`;
        say = state.lang === 'hi-IN' ? HI.route.replace('{dept}', d.name) : reply;
        // draw the multi-floor route on the map
        const loc = DEPT_LOC[d.id] || { level: 2, node: 'opd' };
        drawRoutePlan(buildRoutePlan(loc));
        goto('route');
    } else if (q.includes('help') || q.includes('मदद') || q.includes('sos')) {
        reply = 'Ask me things like: how many beds are free, waiting time in emergency, or is the hospital overcrowded?';
        say = state.lang === 'hi-IN' ? HI.help : reply;
    } else {
        reply = "Sorry, I didn't understand. Try asking about beds, waiting time, overcrowding or routes.";
        say = state.lang === 'hi-IN' ? HI.unknown : reply;
    }
    addChat(raw, reply);
    return say;
}

function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        toast('Voice recognition not supported in this browser. Try Chrome/Edge.');
        return;
    }
    recognition = new SR();
    recognition.lang = state.lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    $('#voice-status').textContent = '🎙️ Listening… speak now';
    $('#voice-mic').disabled = true;
    $('#voice-fab').classList.add('listening');

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        $('#voice-status').textContent = 'Heard: "' + text + '"';
        const say = answerQuery(text);
        setTimeout(() => speak(say), 250);
    };
    recognition.onerror = (e) => {
        $('#voice-status').textContent = 'Error: ' + (e.error || 'unknown') + ' — try again';
        $('#voice-mic').disabled = false;
        $('#voice-fab').classList.remove('listening');
    };
    recognition.onend = () => {
        $('#voice-status').textContent = 'Tap the mic and speak…';
        $('#voice-mic').disabled = false;
        $('#voice-fab').classList.remove('listening');
    };
    recognition.start();
}

function goto(view) {
    const link = $(`.nav a[data-view="${view}"]`);
    if (link) link.click();
}

function toggleVoicePanel(open) {
    $('#voice-panel').classList.toggle('open', open);
}

/* ---------- INIT ---------- */
function init() {
    renderFeatureTags();

    // populate selects
    $('#pred-dept').innerHTML = DEPARTMENTS.map(d => `<option value="${d.id}">${d.icon} ${d.name}</option>`).join('');
    $('#bed-ward').innerHTML = DEPARTMENTS.filter(d => d.kind === 'ward').map(d => `<option value="${d.id}">${d.icon} ${d.name}</option>`).join('');
    $('#pred-dept').value = 'emergency';
    $('#bed-ward').value = 'icu';

    setupNav();
    renderPrediction();
    renderBeds();
    renderFloorMap(1);
    init3DControls();
    renderEmergencyQueue();
    renderAdmin();

    // ambulance dispatch
    populateCitySelect();
    $('#dis-city').addEventListener('change', applyCityToForm);
    $('#btn-detect-loc').addEventListener('click', detectLiveLocation);
    $('#btn-live-track').addEventListener('click', () => state.liveTrack ? pauseLiveTrack() : resumeLiveTrack());
    $('#btn-live-req').addEventListener('click', () => state.reqLive ? stopReqLive() : startReqLive());
    // seed a couple of live requests + start the live loop
    for (let i = 0; i < 3; i++) makeAutoRequest();
    startReqLive();
    // blood bank
    fillBloodSelects();
    renderBloodBank();
    state.bloodTimer = setInterval(liveBloodTick, 5000);
    $('#bb-group').addEventListener('change', renderBloodSearch);
    $('#bb-city').addEventListener('change', () => {
        const opt = $('#bb-city').options[$('#bb-city').selectedIndex];
        if (opt && opt.dataset.lat) { $('#bb-lat').value = opt.dataset.lat; $('#bb-lng').value = opt.dataset.lng; }
    });
    $('#bb-find').addEventListener('click', () => {
        const lat = parseFloat($('#bb-lat').value);
        const lng = parseFloat($('#bb-lng').value);
        if (isNaN(lat) || isNaN(lng)) { toast('Enter valid coordinates'); return; }
        renderNearestFinder(lat, lng, false);
    });
    $('#donor-form').addEventListener('submit', addDonor);
    $('#blood-req-form').addEventListener('submit', requestBlood);

    // auth
    seedAuth();
    renderAuthUI();
    $('#auth-btn').addEventListener('click', () => openAuth('login'));
    $('#auth-close').addEventListener('click', closeAuth);
    $('#auth-overlay').addEventListener('click', e => { if (e.target.id === 'auth-overlay') closeAuth(); });
    $$('.auth-tab').forEach(b => b.addEventListener('click', () => switchAuthTab(b.dataset.tab)));
    $('#login-form').addEventListener('submit', submitLogin);
    $('#signup-form').addEventListener('submit', submitSignup);
    $('#logout-btn').addEventListener('click', logout);

    // chatbot (automated ask & reply)
    $('#chat-fab').addEventListener('click', () => $('#chat-panel').classList.contains('open') ? closeChat() : openChat());
    $('#chat-close').addEventListener('click', closeChat);
    $('#chat-send').addEventListener('click', sendChat);
    $('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
    $('#chat-mic').addEventListener('click', startChatVoice);
    $('#chat-voice-toggle').addEventListener('click', toggleChatVoice);
    $('#chat-persona').addEventListener('change', e => setPersona(e.target.value));
    if (state.persona === undefined) state.persona = loadPersona();
    applyPersona();
    if (state.chatVoice === undefined) state.chatVoice = true;
    if (state.chatVoice) { const v = $('#chat-voice-toggle'); if (v) { v.textContent = '🔊'; v.classList.add('on'); } }
    $('#chat-chips').addEventListener('click', e => {
        const c = e.target.closest('.chip');
        if (!c) return;
        if (state.rescue.active && !state.rescue.done && c.dataset.v) { chatAdd(c.dataset.v, 'user'); rescueAnswer(c.dataset.v); return; }
        if (state.lifestyle.active && !state.lifestyle.done && c.dataset.v) { chatAdd(c.dataset.v, 'user'); lifestyleAnswer(c.dataset.v); return; }
        if (c.dataset.action === 'rescue') { startRescue(); return; }
        if (c.dataset.action === 'lifestyle') { startLifestyle(); return; }
        chatAdd(c.dataset.q, 'user');
        chatTypeReply(c.dataset.q);
    });
    $('#dispatch-form').addEventListener('submit', e => {
        e.preventDefault();
        const name = $('#dis-name').value.trim() || 'Patient';
        const type = $('#dis-type').value;
        const severity = $('#dis-severity').value;
        const lat = parseFloat($('#dis-lat').value);
        const lng = parseFloat($('#dis-lng').value);
        if (isNaN(lat) || isNaN(lng)) { toast('Enter valid coordinates'); return; }
        const spec = EMERGENCY_TYPES[type].spec;
        const support = spec + (severity === 'Critical' || severity === 'High' ? '+ALS' : '+BLS');
        const req = { id: 'E' + (100 + state.requests.length), name, lat, lng, type, severity, support, status: 'Assigned' };
        state.requests.push(req);
        startDispatch({ id: req.id, name, patient: { lat, lng }, type, severity, support });
        $('#dis-name').value = '';
        toast('Ambulance dispatched 🚑');
    });
    renderAmbView();
    // auto-run the critical demo (E001 Rahul) so live tracking starts immediately
    setTimeout(() => {
        const r = state.requests.find(x => x.id === 'E001');
        if (r && !state.dispatch) {
            r.status = 'Assigned';
            startDispatch({ id: 'E001', name: 'Rahul', patient: { lat: 28.6700, lng: 77.4520 }, type: 'Accident', severity: 'Critical', support: 'Trauma+ALS' });
        }
    }, 600);

    // hospitals
    renderFacilityPicker();
    refreshHospSwitch();
    updateHospitalBadges();
    renderHospitals();
    $('#hospital-form').addEventListener('submit', submitHospital);
    $('#hosp-search').addEventListener('input', renderHospitals);
    $('#hosp-switch').addEventListener('change', e => switchHospital(e.target.value));

    // events
    $('#pred-dept').addEventListener('change', renderPrediction);
    $('#pred-horizon').addEventListener('change', renderPrediction);
    $('#pred-weather').addEventListener('change', () => { state.weather = $('#pred-weather').value; toast('AI re-evaluated with ' + $('#pred-weather').options[$('#pred-weather').selectedIndex].text); renderPrediction(); renderAdmin(); });
    $('#btn-refresh-predict').addEventListener('click', () => { seedState(); renderPrediction(); toast('AI model re-run with live feed ✨'); });

    $('#bed-ward').addEventListener('change', renderBedForecast);

    $('#route-reason').addEventListener('change', renderRouting);
    $('#route-severity').addEventListener('change', renderRouting);
    $('#route-bed').addEventListener('change', renderRouting);
    $('#btn-route').addEventListener('click', renderRouting);

    $$('.floor-btn').forEach(b => b.addEventListener('click', () => renderFloorMap(parseInt(b.dataset.floor, 10))));

    // live simulation
    for (let i = 0; i < 6; i++) makeArrival();
    renderTicker();
    $('#btn-live-toggle').addEventListener('click', () => state.live ? stopLive() : startLive());
    $('#btn-live-simulate').addEventListener('click', () => { makeArrival(); renderTicker(); refreshActiveViews(); toast('+1 patient arrival simulated'); });
    startLive();

    $('#btn-add-emergency').addEventListener('click', () => {
        const name = $('#em-name').value.trim();
        const triage = $('#em-triage').value;
        const symptoms = $('#em-symptoms').value.trim();
        if (!name) { toast('Please enter patient name'); return; }
        state.emQueue.push({ name, triage, symptoms, at: Date.now() });
        $('#em-name').value = ''; $('#em-symptoms').value = '';
        renderEmergencyQueue();
        toast('Patient added to AI triage queue — P' + (['critical','urgent','moderate','stable'].indexOf(triage) + 1));
    });

    // voice UI
    $('#voice-fab').addEventListener('click', () => toggleVoicePanel(!$('#voice-panel').classList.contains('open')));
    $('#voice-close').addEventListener('click', () => toggleVoicePanel(false));
    $('#voice-topbar-btn').addEventListener('click', () => { toggleVoicePanel(true); $('#voice-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    $('#voice-launch').addEventListener('click', () => toggleVoicePanel(true));
    $('#voice-mic').addEventListener('click', startVoice);
    $('#voice-stop').addEventListener('click', () => { if (recognition) recognition.stop(); synth.cancel(); });
    $$('.lang-btn').forEach(b => b.addEventListener('click', () => {
        state.lang = b.dataset.lang;
        $$('.lang-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const msg = state.lang === 'hi-IN' ? HI.ready : 'MediFast voice assistant ready. Please speak.';
        addChat(state.lang === 'hi-IN' ? 'भाषा: हिंदी' : 'Language: English', msg);
        speak(msg);
    }));

    window.addEventListener('resize', () => drawLoadChart(DEPARTMENTS.find(d => d.id === $('#pred-dept').value), $('#pred-horizon').value));
}

document.addEventListener('DOMContentLoaded', init);
