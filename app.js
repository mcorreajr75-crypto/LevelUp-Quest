/* =========================================
   LEVELUP QUEST v101.1 - STANDARDIZED LICENSE UPDATE
   ========================================= */

// --- GLOBAL STATE & SAFE INIT ---
let AppState;

/**
 * Safely update text without crashing if ID is missing
 * @param {string} id - The DOM element ID
 * @param {string} text - Text to set
 */
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

/**
 * Safely set CSS style property
 * @param {string} id - The DOM element ID
 * @param {string} property - CSS property (e.g. 'display')
 * @param {string} value - CSS value
 */
function safeSetStyle(id, property, value) {
    const el = document.getElementById(id);
    if (el) el.style[property] = value;
}

// Attempt to load state from LocalStorage
try {
    const rawData = localStorage.getItem('spellingBuddyData');
    AppState = {
        data: rawData ? JSON.parse(rawData) : {
            students: {},
            config: {
                licenseType: 'FREE' // Default: Free Tier
            }
        },
        currentStudent: null,
        activeList: [],
        activeGameMode: 'spelling',
        currentListId: null,
        session: null,
        pendingImport: null
    };
} catch (e) {
    console.error("Data corruption detected. Resetting.");
    AppState = {
        data: {
            students: {},
            config: {
                licenseType: 'FREE'
            }
        },
        currentStudent: null,
        activeList: [],
        activeGameMode: 'spelling',
        currentListId: null,
        session: null,
        pendingImport: null
    };
}

const synth = window.speechSynthesis;

// --- CONFIGURATION ---
const COLORS = {
    "Teal": "#4ECDC4",
    "Crimson": "#eb4d4b",
    "Aqua": "#22a6b3",
    "Purple": "#be2edd",
    "Forest Green": "#6ab04c",
    "Orange": "#f0932b",
    "Indigo": "#4834d4",
    "Slate": "#2c3e50"
};

const EMOJIS = [{
    icon: "🦁",
    label: "Lion"
}, {
    icon: "🐼",
    label: "Panda"
}, {
    icon: "🐯",
    label: "Tiger"
}, {
    icon: "🦄",
    label: "Unicorn"
}, {
    icon: "🦖",
    label: "Dino"
}, {
    icon: "🦊",
    label: "Fox"
}, {
    icon: "🐨",
    label: "Koala"
}, {
    icon: "🐙",
    label: "Octopus"
}, {
    icon: "🐧",
    label: "Penguin"
}, {
    icon: "🦉",
    label: "Owl"
}];

const PRAISE_PHRASES = ["Awesome!", "Great Job!", "Super!", "Fantastic!", "You did it!", "Match!", "Way to go!"];

const PhoneticsMap = {
    "igh": "eye",
    "ing": "ing",
    "ch": "ch",
    "sh": "shhh",
    "th": "th",
    "ph": "f",
    "wh": "w",
    "ck": "k",
    "qu": "kw",
    "ai": "ay",
    "ay": "ay",
    "ee": "e",
    "ea": "e",
    "oa": "oh",
    "oe": "oh",
    "oi": "oy",
    "oy": "oy",
    "ou": "ow",
    "ow": "ow",
    "au": "aw",
    "aw": "aw",
    "oo": "oo",
    "ar": "ar",
    "er": "er",
    "ir": "er",
    "or": "or",
    "ur": "er"
};

// --- UTILITIES ---
function save() {
    localStorage.setItem('spellingBuddyData', JSON.stringify(AppState.data));
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        CelebrationEngine.clear();
    } else {
        console.error(`Screen ID '${id}' not found in HTML.`);
    }
}

// Darken or lighten color for UI accents
function adjustColor(color, amount) {
    if (!color) return "#cccccc";
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(color)) return color;
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

function initTheme() {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            document.documentElement.classList.toggle('dark', e.matches);
        });
    }
}

/**
 * Ensures all student objects have the latest data structure structure
 * (Important for backward compatibility and data integrity)
 */
function normalizeData() {
    // 1. Ensure basic structure
    if (!AppState.data.students || typeof AppState.data.students !== 'object') AppState.data.students = {};
    if (!AppState.data.config) AppState.data.config = {};
    
    // 2. Ensure licenseType exists for legacy data
    if (!AppState.data.config.licenseType) AppState.data.config.licenseType = 'FREE'; 
    
    if (!AppState.activeGameMode) AppState.activeGameMode = 'spelling';

    // 3. Normalize individual student objects
    Object.keys(AppState.data.students).forEach(n => {
        let s = AppState.data.students[n];
        if (!s.history) s.history = {};
        if (!s.listConfigs) s.listConfigs = {};
        if (!s.goalHistory) s.goalHistory = [];
        if (!s.sentences) s.sentences = {};
        if (s.weeklyGoal === undefined) s.weeklyGoal = 10;
        if (s.weeklyProgress === undefined) s.weeklyProgress = 0;
        if (!s.role) s.role = 'Hero';
        if (!s.color) s.color = COLORS["Teal"];
        if (!s.emoji) s.emoji = EMOJIS[0].icon;
        if (!s.medals) s.medals = {
            gold: 0,
            silver: 0,
            bronze: 0
        };
    });
    save();
}

// --- HAPTICS ENGINE ---
// Provides vibration feedback on mobile devices
const Haptics = {
    success: () => {
        if ("vibrate" in navigator) navigator.vibrate(50);
    },
    error: () => {
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    },
    click: () => {
        if ("vibrate" in navigator) navigator.vibrate(10);
    }
};

// --- LICENSING ENGINE ---
/**
 * Manages access control, tier definitions, and limits.
 * Acting as the 'Gatekeeper' for adding data.
 */
const LicenseEngine = {
    /**
     * TIER_CONFIG: Defines the limits for each license type.
     * Centralized here for easy modification.
     */
    tiers: {
        FREE: {
            maxStudents: 1,
            maxListsPerStudent: 3,
            label: "Free Version"
        },
        STANDARD_PACK: {
            maxStudents: 6, // 1 Base + 5 Additional
            maxListsPerStudent: 8, // 3 Base + 5 Additional
            label: "Standard License"
        },
        EDUCATOR: {
            maxStudents: 50,
            maxListsPerStudent: 999, // Effectively unlimited
            label: "Educator Pro"
        }
    },

    /**
     * Retrieves the current active constraints based on AppState.
     * @returns {Object} The tier configuration object
     */
    getCurrentLimits() {
        const licenseType = AppState.data.config.licenseType || 'FREE';
        return this.tiers[licenseType];
    },

    /**
     * Checks if a specific action (adding student/list) is permitted.
     * @param {string} action - 'add_student' or 'add_list'
     * @param {string} [studentId] - ID of student (required for list checks)
     * @returns {boolean} True if allowed, False if blocked (alerts user)
     */
    canProceed(action, studentId = null) {
        const limits = this.getCurrentLimits();
        
        // CASE: Adding a new student
        if (action === 'add_student') {
            const currentCount = Object.keys(AppState.data.students).length;
            if (currentCount >= limits.maxStudents) {
                showAlertModal(`🔒 <strong>Limit Reached</strong><br>The ${limits.label} allows ${limits.maxStudents} students.<br><br>Upgrade in Settings to add more!`);
                return false;
            }
        }

        // CASE: Adding a new list to a student
        if (action === 'add_list' && studentId) {
            const student = AppState.data.students[studentId];
            // We count all lists, visible or not.
            const currentListCount = Object.keys(student.lists || {}).length;
            
            if (currentListCount >= limits.maxListsPerStudent) {
                showAlertModal(`🔒 <strong>Limit Reached</strong><br>The ${limits.label} allows ${limits.maxListsPerStudent} lists per student.<br><br>Upgrade in Settings to create more!`);
                return false;
            }
        }

        return true;
    },

    /**
     * Simulates the upgrade process.
     * NOTE: In production, this would interface with App Store APIs.
     * @param {string} type - The key of the tier (e.g., 'EDUCATOR')
     */
    applyUpgrade(type) {
        if (!this.tiers[type]) {
            console.error("Invalid License Tier");
            return;
        }
        AppState.data.config.licenseType = type;
        save();
        showAlertModal(`🎉 Upgrade Successful!<br>You are now on the <strong>${this.tiers[type].label}</strong>.`);
        CurriculumEngine.renderManager(); // Refresh UI to reflect new limits
    }
};

// --- LOGIC ENGINE ---
// Handles the core spelling game rules
class SpellingGameLogic {
    constructor(wordList) {
        this.list = wordList;
        this.currentIndex = 0;
        this.wrongCount = 0;
        this.wordStartTime = Date.now();
        this.sessionMedals = {
            gold: 0,
            silver: 0,
            bronze: 0
        };
        this.isPaused = false;
    }

    getCurrentWord() {
        return this.list[this.currentIndex] || null;
    }
    resetTimer() {
        this.wordStartTime = Date.now();
    }
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    evaluateGuess(inputVal) {
        if (this.isPaused) return {
            status: 'PAUSED'
        };

        const target = this.getCurrentWord().w;
        const cleanInput = inputVal.trim().toLowerCase();

        if (cleanInput === target) {
            const timeTaken = (Date.now() - this.wordStartTime) / 1000;
            let medalType = 'bronze';
            if (timeTaken < 5) {
                this.sessionMedals.gold++;
                medalType = 'gold';
            } else if (timeTaken < 10) {
                this.sessionMedals.silver++;
                medalType = 'silver';
            } else {
                this.sessionMedals.bronze++;
            }

            const wasFirstTry = (this.wrongCount === 0);
            return {
                status: 'CORRECT',
                word: target,
                timeTaken: timeTaken,
                medal: medalType,
                firstTry: wasFirstTry,
                isSessionComplete: (this.currentIndex + 1 >= this.list.length)
            };
        } else {
            this.wrongCount++;
            const attemptsLeft = 5 - this.wrongCount;
            if (attemptsLeft <= 0) {
                return {
                    status: 'REVEAL',
                    word: target,
                    isSessionComplete: (this.currentIndex + 1 >= this.list.length)
                };
            } else {
                return {
                    status: 'INCORRECT',
                    attemptsLeft: attemptsLeft,
                    showHelp: (this.wrongCount >= 4)
                };
            }
        }
    }

    advance() {
        this.currentIndex++;
        this.wrongCount = 0;
        this.resetTimer();
        return this.getCurrentWord();
    }
}

// --- PORTAL UI LOGIC ---
function selectGameMode(mode) {
    AppState.activeGameMode = mode;
    const btnSpell = document.getElementById('mode-spell');
    const btnMem = document.getElementById('mode-memory');
    if (btnSpell) btnSpell.classList.toggle('active', mode === 'spelling');
    if (btnMem) btnMem.classList.toggle('active', mode === 'memory');

    if (AppState.currentStudent) {
        CurriculumEngine.openDashboard(AppState.currentStudent);
    }
}

// --- MODALS ---
// Helper functions for showing popups
function showModal(contentHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box">${contentHtml}</div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function showAlertModal(message, onClose) {
    const modal = showModal(`<p>${message}</p><div class="modal-buttons"><button class="modal-btn" id="modal-ok">OK</button></div>`);
    modal.querySelector('#modal-ok').onclick = () => {
        modal.remove();
        if (onClose) onClose();
    };
}

function showConfirmModal(message, onConfirm) {
    const modal = showModal(`
        <p>${message}</p>
        <div class="modal-buttons">
            <button class="modal-btn cancel" id="modal-cancel">Cancel</button>
            <button class="modal-btn danger" id="modal-confirm">Confirm</button>
        </div>
    `);
    modal.querySelector('#modal-cancel').onclick = () => modal.remove();
    modal.querySelector('#modal-confirm').onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };
}

function showSelectModal(message, options, onSelect) {
    const optionsHtml = options.map((opt, i) => `<option value="${i}">${opt}</option>`).join('');
    const modal = showModal(`
        <p>${message}</p>
        <select id="modal-select" style="width:100%; margin-bottom:15px;">${optionsHtml}</select>
        <div class="modal-buttons">
            <button class="modal-btn cancel" id="modal-cancel">Cancel</button>
            <button class="modal-btn" id="modal-submit">Select</button>
        </div>
    `);
    modal.querySelector('#modal-cancel').onclick = () => modal.remove();
    modal.querySelector('#modal-submit').onclick = () => {
        const value = modal.querySelector('#modal-select').value;
        modal.remove();
        if (onSelect) onSelect(value);
    };
}

// --- SECURITY ---
// Handles Parent PIN hashing and verification
const SecurityEngine = {
    async hashPin(pin) {
        if (window.crypto && crypto.subtle && window.isSecureContext) {
            const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
            return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
        } else {
            let hash = 5381;
            for (let i = 0; i < pin.length; i++) {
                hash = ((hash << 5) + hash) + pin.charCodeAt(i);
            }
            return "legacy_" + hash.toString();
        }
    },
    showPinGate() {
        document.getElementById('pinInput').value = "";
        safeSetText('pin-msg', AppState.data.config.parentPin ? "Enter PIN" : "Set PIN");
        showScreen('pin-screen');
        setTimeout(() => document.getElementById('pinInput').focus(), 100);
    },
    async handlePinSubmit() {
        const pin = document.getElementById('pinInput').value;
        if (!pin) return;
        const hash = await this.hashPin(pin);

        if (!AppState.data.config.parentPin) {
            AppState.data.config.parentPin = hash;
            save();
            this.unlock();
        } else if (hash === AppState.data.config.parentPin) {
            this.unlock();
        } else {
            showAlertModal("❌ Incorrect PIN");
        }
    },
    async setNewPin() {
        const pin = document.getElementById('newPin').value;
        if (pin.length < 4) {
            showAlertModal("⚠️ PIN must be 4+ digits");
            return;
        }
        AppState.data.config.parentPin = await this.hashPin(pin);
        save();
        showAlertModal("✅ PIN Updated");
    },
    unlock() {
        showScreen('parent-screen');
        CurriculumEngine.renderManager();
    }
};

// --- CURRICULUM ---
// Manages student data, lists, and imports/exports
const CurriculumEngine = {
    renderPortal() {
        const l = document.getElementById('student-list');
        if (!l) return;
        l.innerHTML = "";

        const students = Object.keys(AppState.data.students);
        if (students.length === 0) {
            l.innerHTML = "<p style='text-align:center; opacity:0.6;'>No students yet. Ask a parent to add one!</p>";
            return;
        }

        students.forEach(n => {
            const s = AppState.data.students[n];
            const b = document.createElement('button');
            b.className = "student-btn";
            b.style = `background: ${s.color}; box-shadow: 0 4px 0 ${adjustColor(s.color, -20)};`;
            b.innerHTML = `<span style="font-size: 2rem;">${s.emoji}</span> <div><strong>${n}</strong><br><small style="font-size:0.8rem; opacity:0.9;">Level ${Math.floor(Math.sqrt((s.xp||0)/100))+1} ${s.role}</small></div>`;

            b.onclick = () => {
                try {
                    Haptics.click();
                    this.openDashboard(n);
                } catch (err) {
                    console.error("Open Profile Error:", err);
                    alert("Error opening profile. Check console.");
                }
            };
            l.appendChild(b);
        });
    },

    openDashboard(name) {
        AppState.currentStudent = name;
        const s = AppState.data.students[name];

        if (!s) {
            console.error("Student data not found for:", name);
            return;
        }

        document.body.style.setProperty('--secondary', s.color);
        document.body.style.setProperty('--secondary-dark', adjustColor(s.color, -20));

        safeSetText('portal-welcome', `Welcome, ${name}!`);
        safeSetText('buddy-emoji', s.emoji);
        safeSetText('portal-level-badge', `Level ${Math.floor(Math.sqrt((s.xp||0)/100))+1} ${s.role}`);
        safeSetStyle('xp-bar', 'width', ((s.xp || 0) % 100) + "%");

        const m = s.medals || {
            gold: 0,
            silver: 0,
            bronze: 0
        };
        safeSetText('portal-gold', m.gold);
        safeSetText('portal-silver', m.silver);
        safeSetText('portal-bronze', m.bronze);

        safeSetText('streak-display', `🔥 ${s.streak || 0} Days`);
        safeSetText('goal-streak-display', `🏅 ${AnalyticsEngine.calculateGoalStreak(name)} Weeks`);

        const goalPerc = Math.min(((s.weeklyProgress || 0) / (s.weeklyGoal || 10)) * 100, 100);
        safeSetStyle('goal-bar', 'width', goalPerc + "%");
        safeSetText('goal-text', `Quest Goal: ${s.weeklyProgress || 0}/${s.weeklyGoal || 10}`);

        const mode = AppState.activeGameMode || 'spelling';
        const btnSpell = document.getElementById('mode-spell');
        const btnMem = document.getElementById('mode-memory');
        if (btnSpell) btnSpell.classList.toggle('active', mode === 'spelling');
        if (btnMem) btnMem.classList.toggle('active', mode === 'memory');

        const c = document.getElementById('student-lists-container');
        if (c) {
            c.innerHTML = "";
            let visCount = 0;
            Object.keys(s.lists || {}).forEach(ln => {
                if (s.listConfigs?.[ln]?.visible !== false) {
                    visCount++;
                    const btn = document.createElement('button');
                    btn.className = "quest-btn";
                    btn.style = `border: 3px solid ${s.color}; box-shadow: 0 5px 0 ${s.color};`;
                    btn.innerHTML = `<span style="font-size:1.5rem; margin-right:10px;">📜</span> <span style="font-weight:900;">${ln}</span>`;
                    btn.onclick = () => {
                        Haptics.click();
                        if (AppState.activeGameMode === 'memory') {
                            MemoryEngine.init(ln);
                        } else {
                            GameplayEngine.startPractice(ln);
                        }
                    };
                    c.appendChild(btn);
                }
            });

            if (visCount > 1) {
                const allBtn = document.createElement('button');
                allBtn.style = "width:100%; background:var(--gold); color:#333; margin-top:15px; border:none; box-shadow: 0 4px 0 #e1b12c; font-size:1.2rem; padding:18px;";
                allBtn.innerHTML = "<strong>🔥 MASTER QUEST (All Words)</strong>";
                allBtn.onclick = () => {
                    Haptics.click();
                    if (AppState.activeGameMode === 'memory') {
                        MemoryEngine.init('ALL');
                    } else {
                        GameplayEngine.startPractice('ALL');
                    }
                };
                c.appendChild(allBtn);
            }
        }
        showScreen('student-portal');
    },

    renderManager() {
        const input = document.getElementById('parent-search');
        const q = input ? input.value.toLowerCase() : "";
        const list = document.getElementById('student-management-list');
        if (!list) return;
        list.innerHTML = "";

        // UPDATE LICENSE INFO (UX REQUIREMENT)
        // Displays current tier and usage to user
        const limitData = LicenseEngine.getCurrentLimits();
        const licenseLabel = document.getElementById('current-license-display');
        if(licenseLabel) {
            licenseLabel.innerHTML = `Current: <strong>${limitData.label}</strong><br>` + 
            `<small>Students: ${Object.keys(AppState.data.students).length} / ${limitData.maxStudents}</small>`;
        }

        Object.keys(AppState.data.students).forEach(n => {
            const s = AppState.data.students[n];
            const m = s.medals || {
                gold: 0,
                silver: 0,
                bronze: 0
            };

            const card = document.createElement('div');
            card.className = "manager-card";
            card.innerHTML = `<h3>👤 ${n}
                <button onclick="CurriculumEngine.deleteStudent('${n}')" class="sm-btn" style="background:var(--danger); float:right; margin-left:5px;">🗑️</button>
                <button onclick="CurriculumEngine.resetStudent('${n}')" class="sm-btn" style="background:var(--accent); color:#333; float:right;">🔄</button>
            </h3>
                <div class="control-row">
                    <select onchange="CurriculumEngine.updateStudentProp('${n}','emoji',this.value)">${EMOJIS.map(e=>`<option value="${e.icon}" ${s.emoji===e.icon?'selected':''}>${e.icon} ${e.label}</option>`).join('')}</select>
                    <select onchange="CurriculumEngine.updateStudentProp('${n}','color',this.value)">${Object.keys(COLORS).map(name => `<option value="${COLORS[name]}" ${s.color===COLORS[name]?'selected':''}>${name}</option>`).join('')}</select>
                </div>
                
                <div class="control-row" style="margin-top:8px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:8px;">
                    <span style="font-size:0.9rem;"><strong>Medals:</strong> 🥇${m.gold} 🥈${m.silver} 🥉${m.bronze}</span>
                    <button onclick="CurriculumEngine.resetMedals('${n}')" class="sm-btn secondary-btn" style="padding:4px 10px; font-size:0.8rem;">Reset</button>
                </div>

                <div class="control-row goal-row">
                    <strong>Weekly Goal:</strong>
                    <input type="number" value="${s.weeklyGoal||10}" onchange="CurriculumEngine.updateStudentProp('${n}','weeklyGoal',this.value)" class="goal-input">
                </div>
                <div id="goal-history-${n}"></div><div id="lists-for-${n}"></div>
                <div style="margin-top:15px; border-top:1px solid #ddd; padding-top:15px; display:flex; gap:5px;">
                    <input id="new-ln-${n}" placeholder="List Name">
                    <button onclick="CurriculumEngine.createNewList('${n}')" class="sm-btn">Add</button>
                    <button onclick="CurriculumEngine.initiateImport('${n}')" class="sm-btn" style="background:#0984e3;">📥 Import</button>
                </div>`;
            list.appendChild(card);
            this.renderListsInParent(n, q);
            AnalyticsEngine.renderGoalHistory(n);
        });
        AnalyticsEngine.renderLeaderboard();
    },

    renderListsInParent(n, q) {
        const s = AppState.data.students[n];
        const cont = document.getElementById(`lists-for-${n}`);
        if (!cont) return;

        Object.keys(s.lists || {}).forEach(ln => {
            const words = s.lists[ln].join(', ');
            if (q && !words.includes(q)) return;
            const isVis = s.listConfigs?.[ln]?.visible !== false;
            const div = document.createElement('div');
            div.className = `list-entry ${!isVis?'archived':''}`;
            div.innerHTML = `<div class="flex-between"><strong>📜 ${ln}</strong> 
                <div>
                <button onclick="CurriculumEngine.toggleArch('${n}','${ln}')" class="sm-btn secondary-btn" style="padding:4px 8px;">${isVis?'Hide':'Show'}</button>
                <button onclick="CurriculumEngine.exportList('${n}','${ln}')" class="sm-btn" style="background:#00b894; padding:4px 8px;">📤</button>
                <button onclick="CurriculumEngine.deleteList('${n}','${ln}')" class="sm-btn" style="background:var(--danger); padding:4px 8px;">✖</button>
                </div></div>
                <textarea onchange="CurriculumEngine.updateWords('${n}','${ln}',this.value)" style="width:100%; height:60px; margin:5px 0;">${words}</textarea>
                <textarea onchange="CurriculumEngine.updateSents('${n}','${ln}',this.value)" placeholder="Sentences" style="width:100%; height:60px;">${(s.sentences?.[ln] || []).join(', ')}</textarea>`;
            cont.appendChild(div);
        });
    },

    addNewStudent() {
        // [GUARD CLAUSE] Check License status before proceeding
        // Returns early if limit is reached
        if (!LicenseEngine.canProceed('add_student')) return;

        const nInput = document.getElementById('new-student-name');
        const n = nInput ? nInput.value.trim() : "";
        if (n) {
            AppState.data.students[n] = {
                lists: {},
                xp: 0,
                history: {},
                listConfigs: {},
                goalHistory: [],
                sentences: {},
                role: 'Hero',
                streak: 0,
                weeklyProgress: 0,
                color: COLORS["Teal"],
                emoji: EMOJIS[0].icon,
                medals: {
                    gold: 0,
                    silver: 0,
                    bronze: 0
                }
            };
            save();
            this.renderManager();
            this.renderPortal();
            nInput.value = "";
            showAlertModal(`✅ ${n} has been added!`);
        } else {
            showAlertModal("⚠️ Please enter a student name.");
        }
    },

    updateStudentProp(n, p, v) {
        AppState.data.students[n][p] = v;
        save();
        if (p === 'color' || p === 'emoji') this.renderPortal();
    },
    createNewList(n) {
        // [GUARD CLAUSE] Check License status before proceeding
        // Returns early if limit is reached
        if (!LicenseEngine.canProceed('add_list', n)) return;

        const input = document.getElementById(`new-ln-${n}`);
        const ln = input ? input.value.trim() : "";
        if (ln) {
            if (!AppState.data.students[n].lists) AppState.data.students[n].lists = {};
            AppState.data.students[n].lists[ln] = [];
            save();
            this.renderManager();
        } else {
            showAlertModal("⚠️ Please enter a list name.");
        }
    },
    updateWords(n, ln, v) {
        AppState.data.students[n].lists[ln] = v.split(',').map(i => i.trim().toLowerCase()).filter(i => i);
        save();
    },
    updateSents(n, ln, v) {
        if (!AppState.data.students[n].sentences) AppState.data.students[n].sentences = {};
        AppState.data.students[n].sentences[ln] = v.split(',').map(i => i.trim()).filter(i => i);
        save();
    },
    toggleArch(n, ln) {
        if (!AppState.data.students[n].listConfigs) AppState.data.students[n].listConfigs = {};
        if (!AppState.data.students[n].listConfigs[ln]) AppState.data.students[n].listConfigs[ln] = {};
        AppState.data.students[n].listConfigs[ln].visible = !AppState.data.students[n].listConfigs[ln].visible;
        save();
        this.renderManager();
    },
    deleteList(n, ln) {
        showConfirmModal(`🗑️ Delete "${ln}"?`, () => {
            delete AppState.data.students[n].lists[ln];
            save();
            this.renderManager();
        });
    },
    resetMedals(n) {
        showConfirmModal(`Reset medals for ${n}?`, () => {
            if (AppState.data.students[n]) {
                AppState.data.students[n].medals = {
                    gold: 0,
                    silver: 0,
                    bronze: 0
                };
                save();
                this.renderManager();
                showAlertModal("✅ Medals reset.");
            }
        });
    },
    resetStudent(n) {
        showSelectModal(`Reset ${n}?`, ["Wipe Progress (XP/History)", "Wipe Lists"], (choice) => {
            if (choice === "0") {
                AppState.data.students[n].xp = 0;
                AppState.data.students[n].history = {};
                AppState.data.students[n].goalHistory = [];
                AppState.data.students[n].streak = 0;
                AppState.data.students[n].weeklyProgress = 0;
            } else if (choice === "1") {
                AppState.data.students[n].lists = {};
                AppState.data.students[n].sentences = {};
            }
            save();
            this.renderManager();
            showAlertModal("✅ Reset complete.");
        });
    },
    deleteStudent(n) {
        showConfirmModal(`🗑️ Delete ${n}?`, () => {
            delete AppState.data.students[n];
            save();
            this.renderManager();
            this.renderPortal();
        });
    },
    exportData() {
        const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState.data));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "levelup_quest_backup.json");
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
    },
    importData() {
        document.getElementById('importFile').click();
    },
    initiateImport(n) {
        AppState.pendingImport = n;
        document.getElementById('importListFile').click();
    },
    processListImport(input) {
        if (!input.files[0] || !AppState.pendingImport) return;
        const r = new FileReader();
        r.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.type !== "levelup-list") {
                    showAlertModal("❌ Invalid Quest List.");
                    return;
                }
                const s = AppState.data.students[AppState.pendingImport];
                s.lists[data.name] = data.words;
                if (data.sentences) s.sentences[data.name] = data.sentences;
                save();
                this.renderManager();
                showAlertModal(`✅ Imported "${data.name}"!`);
            } catch (err) {
                showAlertModal("❌ File error.");
            }
        };
        r.readAsText(input.files[0]);
    },
    finalizeListImport(n, data) {
        const s = AppState.data.students[n];
        s.lists[data.name] = data.words;
        if (data.sentences) s.sentences[data.name] = data.sentences;
        save();
        this.renderManager();
        showAlertModal(`✅ Quest "${data.name}" imported successfully!`);
    }
};

// --- PORTAL UI LOGIC (Global scope for button access) ---
window.selectGameMode = function(mode) {
    AppState.activeGameMode = mode;
    const btnSpell = document.getElementById('mode-spell');
    const btnMem = document.getElementById('mode-memory');
    if (btnSpell) btnSpell.classList.toggle('active', mode === 'spelling');
    if (btnMem) btnMem.classList.toggle('active', mode === 'memory');

    if (AppState.currentStudent) {
        CurriculumEngine.openDashboard(AppState.currentStudent);
    }
};

// --- GAMEPLAY ENGINE ---
// Handles audio, input checking, and feedback
const GameplayEngine = {
    // Current Logic Instance
    logic: null,

    setupVoices() {
        const p = document.getElementById('voice-picker');
        if (!p) return;
        const voices = synth.getVoices();
        p.innerHTML = voices.map(v => `<option value="${v.voiceURI}" ${AppState.data.config.voiceURI === v.voiceURI ? 'selected' : ''}>${v.name}</option>`).join('');
    },
    speak(t) {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(t);
        const selected = synth.getVoices().find(v => v.voiceURI === AppState.data.config.voiceURI);
        if (selected) u.voice = selected;
        u.rate = 0.85;
        synth.speak(u);
    },
    testVoiceSelection() {
        const picker = document.getElementById('voice-picker');
        if (picker) {
            AppState.data.config.voiceURI = picker.value;
            save();
            this.speak("Quest voice ready.");
        }
    },
    startPractice(key) {
        AppState.currentListId = key;
        const s = AppState.data.students[AppState.currentStudent];
        let paired = [];

        if (key === 'ALL') {
            Object.keys(s.lists).forEach(k => {
                if (s.listConfigs?.[k]?.visible !== false) {
                    s.lists[k].forEach((w, i) => paired.push({
                        w,
                        s: s.sentences?.[k]?.[i] || ""
                    }));
                }
            });
        } else {
            s.lists[key].forEach((w, i) => paired.push({
                w,
                s: s.sentences?.[key]?.[i] || ""
            }));
        }

        if (paired.length === 0) {
            showAlertModal("⚠️ No words in this quest! Add some words first.");
            return;
        }

        // INIT NEW GAME LOGIC
        const shuffled = paired.sort(() => Math.random() - 0.5);
        this.logic = new SpellingGameLogic(shuffled);

        AppState.activeList = shuffled;

        showScreen('game-screen');
        safeSetText('buddy-emoji-game', s.emoji);
        this.updateUI();
        setTimeout(() => document.getElementById('spelling-input').focus(), 500);
    },
    checkSpelling() {
        if (!this.logic || this.logic.isPaused) return;

        const input = document.getElementById('spelling-input');
        const feedback = document.getElementById('feedback-msg');

        // DELEGATE TO LOGIC
        const result = this.logic.evaluateGuess(input.value);

        feedback.classList.remove('text-success', 'text-danger');

        if (result.status === 'CORRECT') {
            // UI: Success
            Haptics.success();
            input.classList.add('success-anim');
            setTimeout(() => input.classList.remove('success-anim'), 500);

            // UI: Data Update
            const s = AppState.data.students[AppState.currentStudent];
            let xp = (result.firstTry) ? 30 : 20;
            s.xp += xp;
            s.weeklyProgress++;

            // UI: Check Goal
            if (s.weeklyProgress === (s.weeklyGoal || 10)) {
                const d = new Date().toLocaleDateString();
                if (!s.goalHistory.includes(d)) s.goalHistory.push(d);
                this.playVictoryFanfare();
                if (typeof confetti === 'function') confetti({
                    particleCount: 200,
                    origin: {
                        y: 0.6
                    }
                });
            }

            // UI: History Log
            if (!s.history[result.word]) s.history[result.word] = {
                missed: 0,
                times: [],
                dates: []
            };
            s.history[result.word].times.push(result.timeTaken);

            feedback.classList.add('text-success');
            feedback.innerText = (result.firstTry) ? "⭐ 1ST-TRY BONUS!" : "Correct!";

            input.value = "";
            this.speak("Correct!");
            if (typeof confetti === 'function') confetti({
                particleCount: 100
            });

            save();

            // Logic: Advance
            setTimeout(() => {
                if (result.isSessionComplete) {
                    this.finishSession();
                } else {
                    this.logic.advance();
                    this.updateUI();
                }
            }, 3000);

        } else if (result.status === 'INCORRECT') {
            // UI: Error
            Haptics.error();
            input.classList.add('shake-anim');
            setTimeout(() => input.classList.remove('shake-anim'), 500);

            feedback.classList.add('text-danger');

            if (result.showHelp) document.getElementById('help-btn').classList.remove('hidden');

            feedback.innerText = `Incorrect! (${result.attemptsLeft} left)`;
            this.speak("Incorrect!");
            input.select();

        } else if (result.status === 'REVEAL') {
            // UI: Reveal
            Haptics.error();
            feedback.classList.add('text-danger');
            feedback.innerText = `Revealed: ${result.word.toUpperCase()}`;
            this.speak(`Correct is ${result.word.split('').join(' ')}.`);
            input.value = "";

            save();

            setTimeout(() => {
                if (result.isSessionComplete) {
                    this.finishSession();
                } else {
                    this.logic.advance();
                    this.updateUI();
                }
            }, 8000);
        }
    },
    updateUI() {
        this.logic.resetTimer(); // Sync timer with UI render
        document.getElementById('speech-bubble').classList.add('hidden');
        document.getElementById('help-btn').classList.add('hidden');
        const fb = document.getElementById('feedback-msg');
        fb.classList.remove('text-success', 'text-danger');
        fb.style.color = "var(--text-light)";
        fb.innerText = "Questing...";

        safeSetText('progress-text', `Word ${this.logic.currentIndex + 1}/${this.logic.list.length}`);

        this.repeatWord();
    },
    repeatWord() {
        const w = this.logic.getCurrentWord();
        if (!this.logic.isPaused && w) {
            this.speak(w.w);
        }
    },
    playPhonetics() {
        const current = this.logic.getCurrentWord();
        if (this.logic.isPaused || !current) return;

        const word = current.w.toLowerCase();
        const sounds = [];
        let i = 0;
        while (i < word.length) {
            const threeChars = word.substr(i, 3);
            const twoChars = word.substr(i, 2);
            const oneChar = word.substr(i, 1);
            if (threeChars.length === 3 && PhoneticsMap[threeChars]) {
                sounds.push(PhoneticsMap[threeChars]);
                i += 3;
            } else if (twoChars.length === 2 && PhoneticsMap[twoChars]) {
                sounds.push(PhoneticsMap[twoChars]);
                i += 2;
            } else {
                sounds.push(PhoneticsMap[oneChar] || oneChar);
                i += 1;
            }
        }
        synth.cancel();
        sounds.forEach(sound => {
            const u = new SpeechSynthesisUtterance(sound);
            const selected = synth.getVoices().find(v => v.voiceURI === AppState.data.config.voiceURI);
            if (selected) u.voice = selected;
            u.rate = 0.8;
            synth.speak(u);
        });
        document.getElementById('spelling-input').focus();
    },
    togglePause() {
        if (!this.logic) return;
        const paused = this.logic.togglePause();

        const overlay = document.getElementById('stop-overlay');
        if (overlay) overlay.classList.toggle('hidden', !paused);

        if (paused) synth.cancel();
        else {
            this.repeatWord();
            document.getElementById('spelling-input').focus();
        }
    },
    exitGame() {
        showConfirmModal("🏠 Exit?", () => {
            showScreen('student-portal');
            this.logic = null;
        });
    },
    playVictoryFanfare() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [261, 329, 392, 523].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.frequency.value = f;
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.4);
        });
    },
    finishSession() {
        const s = AppState.data.students[AppState.currentStudent];
        const medals = this.logic.sessionMedals;

        if (!s.medals) s.medals = {
            gold: 0,
            silver: 0,
            bronze: 0
        };

        s.medals.gold += medals.gold;
        s.medals.silver += medals.silver;
        s.medals.bronze += medals.bronze;

        safeSetText('win-gold', medals.gold);
        safeSetText('win-silver', medals.silver);
        safeSetText('win-bronze', medals.bronze);

        showScreen('win-screen');
        save();
        CelebrationEngine.playRandom();
        this.logic = null; // Cleanup
    }
};

// --- MEMORY ENGINE (UPDATED: PACED TARGETS) ---
// Handles the card matching game mode
const MemoryEngine = {
    cardsArray: [],
    hasFlippedCard: false,
    lockBoard: false,
    firstCard: null,
    secondCard: null,
    matchesFound: 0,
    totalPairs: 0,
    currentTarget: null,
    remainingPairs: [],

    init(listName) {
        AppState.currentListId = listName;
        const s = AppState.data.students[AppState.currentStudent];
        let words = [];
        if (listName === 'ALL') {
            Object.keys(s.lists).forEach(k => {
                if (s.listConfigs?.[k]?.visible !== false) words = [...words, ...s.lists[k]];
            });
        } else {
            words = s.lists[listName];
        }

        if (!words || words.length === 0) {
            showAlertModal("⚠️ This list is empty!");
            return;
        }

        let gameWords = [...words];
        if (gameWords.length > 6) gameWords = gameWords.sort(() => 0.5 - Math.random()).slice(0, 6);

        this.cardsArray = [...gameWords, ...gameWords];
        this.remainingPairs = [...gameWords];
        this.totalPairs = gameWords.length;
        this.matchesFound = 0;
        this.cardsArray.sort(() => 0.5 - Math.random());

        this.renderBoard(s);
        this.setNewTarget();

        if (!s.medals) s.medals = {
            gold: 0,
            silver: 0,
            bronze: 0
        };
        safeSetText('mem-gold', s.medals.gold);
        safeSetText('mem-silver', s.medals.silver);
        safeSetText('mem-bronze', s.medals.bronze);
        safeSetText('memory-progress', `Matches: 0 / ${this.totalPairs}`);
        showScreen('memory-screen');
    },
    renderBoard(student) {
        const grid = document.getElementById('memory-grid');
        grid.innerHTML = '';
        [this.hasFlippedCard, this.lockBoard] = [false, false];
        [this.firstCard, this.secondCard] = [null, null];
        this.cardsArray.forEach((word) => {
            const card = document.createElement('div');
            card.classList.add('memory-card');
            card.dataset.framework = word;
            const front = document.createElement('div');
            front.classList.add('card-face', 'card-front');
            front.innerHTML = student.emoji;
            front.style.backgroundColor = student.color;
            const back = document.createElement('div');
            back.classList.add('card-face', 'card-back');
            back.style.color = student.color;
            back.style.borderColor = student.color;
            back.innerText = word;
            card.appendChild(front);
            card.appendChild(back);
            card.addEventListener('click', () => this.flipCard(card));
            grid.appendChild(card);
        });
    },
    setNewTarget() {
        if (this.remainingPairs.length === 0) return;
        this.currentTarget = this.remainingPairs[Math.floor(Math.random() * this.remainingPairs.length)];
        safeSetText('memory-target-text', this.currentTarget);
        const container = document.getElementById('memory-target-container');
        if (container) container.classList.remove('hidden');
        this.sayAndSpell(this.currentTarget);
    },
    sayAndSpell(word, onComplete) {
        this.lockBoard = true;
        synth.cancel();

        const uWord = new SpeechSynthesisUtterance(word);
        const uSpell = new SpeechSynthesisUtterance(word.split('').join(' '));

        const selected = synth.getVoices().find(v => v.voiceURI === AppState.data.config.voiceURI);
        if (selected) {
            uWord.voice = selected;
            uSpell.voice = selected;
        }
        uWord.rate = 0.85;
        uSpell.rate = 0.75;

        uSpell.onend = () => {
            this.lockBoard = false;
            if (onComplete) onComplete();
        };

        setTimeout(() => {
            if (this.lockBoard) {
                this.lockBoard = false;
                if (onComplete) onComplete();
            }
        }, 6000);
        synth.speak(uWord);
        synth.speak(uSpell);
    },
    flipCard(card) {
        if (this.lockBoard || card === this.firstCard) return;
        card.classList.add('flipped');
        if (!this.hasFlippedCard) {
            this.hasFlippedCard = true;
            this.firstCard = card;
            GameplayEngine.speak(card.dataset.framework);
            return;
        }
        this.secondCard = card;
        GameplayEngine.speak(card.dataset.framework);
        this.checkForMatch();
    },
    checkForMatch() {
        let isMatch = this.firstCard.dataset.framework === this.secondCard.dataset.framework;
        let isTarget = this.firstCard.dataset.framework === this.currentTarget;

        // Forced Target Logic
        if (isMatch && isTarget) {
            this.disableCards(); // Success
        } else if (isMatch && !isTarget) {
            this.handleNonTargetMatch(); // Match found, but rejected
        } else {
            this.unflipCards(); // No match
        }
    },
    disableCards() {
        this.lockBoard = true;
        setTimeout(() => {
            Haptics.success();
            this.matchesFound++;
            safeSetText('memory-progress', `Matches: ${this.matchesFound} / ${this.totalPairs}`);

            CelebrationEngine.showPraise();
            const s = AppState.data.students[AppState.currentStudent];
            s.xp += 5;

            // Remove from remaining targets
            this.remainingPairs = this.remainingPairs.filter(w => w !== this.currentTarget);

            setTimeout(() => {
                if (this.firstCard) this.firstCard.classList.add('matched');
                if (this.secondCard) this.secondCard.classList.add('matched');

                if (this.matchesFound === this.totalPairs) {
                    this.gameWon();
                } else {
                    this.resetBoard();
                    this.setNewTarget();
                }
            }, 2000);
        }, 800);
    },
    handleNonTargetMatch() {
        this.lockBoard = true;
        Haptics.error();

        // 1. Visual Pause: Let the user see the cards before speaking
        setTimeout(() => {
            const foundWord = this.firstCard.dataset.framework;
            const text = `That is ${foundWord}. But we need ${this.currentTarget}.`;

            synth.cancel();
            const u = new SpeechSynthesisUtterance(text);
            const selected = synth.getVoices().find(v => v.voiceURI === AppState.data.config.voiceURI);
            if (selected) u.voice = selected;
            u.rate = 0.85;

            // 2. Completion Logic: Wait for speech to finish
            let hasFinished = false;
            const finish = () => {
                if (hasFinished) return;
                hasFinished = true;

                // 3. Post-Speech Pause: Wait 1s before resetting
                setTimeout(() => {
                    if (this.firstCard) this.firstCard.classList.remove('flipped');
                    if (this.secondCard) this.secondCard.classList.remove('flipped');
                    this.resetBoard();
                    this.sayAndSpell(this.currentTarget);
                }, 1000);
            };

            u.onend = finish;
            setTimeout(finish, 8000); // Safety fallback if onend fails

            synth.speak(u);
        }, 1000); // 1s Visual Delay
    },
    unflipCards() {
        this.lockBoard = true;
        Haptics.error();
        setTimeout(() => {
            if (this.firstCard) this.firstCard.classList.remove('flipped');
            if (this.secondCard) this.secondCard.classList.remove('flipped');
            this.resetBoard();
            this.sayAndSpell(this.currentTarget);
        }, 1500);
    },
    resetBoard() {
        [this.hasFlippedCard, this.lockBoard] = [false, false];
        [this.firstCard, this.secondCard] = [null, null];
    },
    gameWon() {
        GameplayEngine.playVictoryFanfare();
        const s = AppState.data.students[AppState.currentStudent];
        s.xp += 50;
        s.weeklyProgress++;
        if (!s.medals) s.medals = {
            gold: 0,
            silver: 0,
            bronze: 0
        };
        s.medals.gold++;
        save();
        CelebrationEngine.playRandom();
        safeSetText('win-gold', "1");
        safeSetText('win-silver', "0");
        safeSetText('win-bronze', "0");
        showScreen('win-screen');
    },
    exitGame() {
        showConfirmModal("🏠 Exit?", () => {
            showScreen('student-portal');
        });
    },
    restart() {
        if (AppState.currentListId) this.init(AppState.currentListId);
        else showScreen('student-portal');
    }
};

// --- CELEBRATION ENGINE ---
// Manages visual rewards (confetti, balloons)
const CelebrationEngine = {
    container: null,
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'celebration-container';
            document.body.appendChild(this.container);
        }
        this.container.innerHTML = '';
    },
    clear() {
        if (this.container) this.container.innerHTML = '';
    },
    showPraise() {
        this.init();
        const text = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
        GameplayEngine.speak(text);
        const el = document.createElement('div');
        el.className = 'floating-praise';
        el.innerText = text;
        this.container.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    },
    playRandom() {
        this.init();
        const effects = [this.fireworks, this.balloons, this.stars, this.rainbows, this.confettiBurst];
        effects[Math.floor(Math.random() * effects.length)].call(this);
    },
    confettiBurst() {
        if (typeof confetti === 'function') confetti({
            particleCount: 150,
            spread: 70,
            origin: {
                y: 0.6
            }
        });
    },
    fireworks() {
        if (typeof confetti === 'function') {
            const duration = 3000;
            const end = Date.now() + duration;
            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: {
                        x: 0
                    }
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: {
                        x: 1
                    }
                });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        }
    },
    balloons() {
        for (let i = 0; i < 10; i++) this.createFloater('🎈', 'floatUp', 2 + Math.random() * 2);
    },
    stars() {
        for (let i = 0; i < 15; i++) this.createFloater('⭐', 'shootAcross', 1 + Math.random() * 2);
    },
    rainbows() {
        for (let i = 0; i < 8; i++) this.createFloater('🌈', 'bounceAround', 2 + Math.random() * 2);
    },
    createFloater(emoji, anim, dur) {
        const el = document.createElement('div');
        el.innerText = emoji;
        el.className = 'anim-item';
        el.style.left = Math.random() * 90 + 'vw';
        el.style.top = '100vh';
        el.style.animation = `${anim} ${dur}s linear forwards`;
        this.container.appendChild(el);
    }
};

// --- ANALYTICS ENGINE ---
// Visualization of student progress
const AnalyticsEngine = {
    calculateGoalStreak(n) {
        const s = AppState.data.students[n];
        if (!s.goalHistory?.length) return 0;
        return s.goalHistory.length;
    },
    renderGoalHistory(n) {
        const s = AppState.data.students[n];
        const cont = document.getElementById(`goal-history-${n}`);
        if (cont) cont.innerHTML = s.goalHistory?.length ? `<strong>🏆 Log:</strong> <div class="achievement-log">${s.goalHistory.map(d => `<div>🏆 ${d}</div>`).join('')}</div>` : "<small>No milestones.</small>";
    },
    renderLeaderboard() {
        const c = document.getElementById('leaderboard-container');
        if (!c) return;
        c.innerHTML = "";
        const sorted = Object.keys(AppState.data.students).map(n => ({
            n,
            xp: AppState.data.students[n].xp || 0,
            emoji: AppState.data.students[n].emoji
        })).sort((a, b) => b.xp - a.xp);
        if (sorted.length === 0) c.innerHTML = "<div style='padding:15px;opacity:0.6'>No students yet.</div>";
        sorted.forEach((s, i) => {
            const d = document.createElement('div');
            d.className = 'leaderboard-entry';
            d.innerHTML = `<div class="rank">#${i+1}</div><div class="avatar">${s.emoji}</div><div class="info"><div class="name">${s.n}</div><div class="xp-badge">${s.xp} XP</div></div>`;
            d.onclick = () => {
                AppState.currentStudent = s.n;
                AnalyticsEngine.renderCharts();
            };
            c.appendChild(d);
        });
        if (sorted.length > 0 && !AppState.currentStudent) {
            AppState.currentStudent = sorted[0].n;
            setTimeout(() => AnalyticsEngine.renderCharts(), 100);
        }
    },
    renderCharts() {
        if (!AppState.currentStudent) return;
        const s = AppState.data.students[AppState.currentStudent];
        const spd = [],
            acc = [];
        Object.values(s.history || {}).forEach(d => {
            if (d.times.length) spd.push(d.times.reduce((a, b) => a + b, 0) / d.times.length);
            if (d.missed !== undefined) acc.push(100 - (d.missed * 10));
        });
        safeSetText('speed-title', `${AppState.currentStudent}'s Speed`);
        safeSetText('accuracy-title', `${AppState.currentStudent}'s Accuracy`);
        this.drawChart("speedChart", spd, "s", 20);
        this.drawChart("accuracyChart", acc, "%", 100);
    },
    drawChart(id, vals, unit = "", forceMax = null) {
        const c = document.getElementById(id);
        if (!c) return;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);

        const PADDING_LEFT = 50;
        const PADDING_BOTTOM = 30;
        const CHART_HEIGHT = c.height - PADDING_BOTTOM;
        const CHART_WIDTH = c.width - PADDING_LEFT;

        // Draw empty state
        if (!vals || !vals.length) {
            ctx.fillStyle = "#b2bec3";
            ctx.font = "16px Nunito";
            ctx.fillText(`No data`, PADDING_LEFT, CHART_HEIGHT / 2);
            return;
        }

        const max = forceMax || Math.max(...vals, 1);

        // --- DRAW GRID & Y-AXIS LABELS ---
        ctx.strokeStyle = "#e0e0e0";
        ctx.fillStyle = "#95a5a6";
        ctx.font = "12px Nunito";
        ctx.textAlign = "right";
        ctx.lineWidth = 1;

        // Top Line (Max)
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, 10);
        ctx.lineTo(c.width, 10);
        ctx.stroke();
        ctx.fillText(`${max}${unit}`, PADDING_LEFT - 5, 14);

        // Middle Line (Half)
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, CHART_HEIGHT / 2);
        ctx.lineTo(c.width, CHART_HEIGHT / 2);
        ctx.stroke();
        ctx.fillText(`${Math.round(max/2)}${unit}`, PADDING_LEFT - 5, (CHART_HEIGHT / 2) + 4);

        // Bottom Line (0)
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, CHART_HEIGHT);
        ctx.lineTo(c.width, CHART_HEIGHT);
        ctx.stroke();
        ctx.fillText(`0${unit}`, PADDING_LEFT - 5, CHART_HEIGHT);

        // X-Axis Label
        ctx.textAlign = "center";
        ctx.fillText("Last 5 Sessions ->", (c.width / 2) + 20, c.height - 5);

        // --- DRAW DATA LINE ---
        ctx.beginPath();
        const startY = CHART_HEIGHT - ((vals[0] / max) * (CHART_HEIGHT - 10));
        ctx.moveTo(PADDING_LEFT, Math.max(10, Math.min(CHART_HEIGHT, startY)));

        const color = (AppState.data.students[AppState.currentStudent] && AppState.data.students[AppState.currentStudent].color) || "#4ECDC4";
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const step = CHART_WIDTH / (Math.max(vals.length - 1, 1));

        vals.forEach((v, i) => {
            const x = PADDING_LEFT + (i * step);
            const y = CHART_HEIGHT - ((Math.min(v, max) / max) * (CHART_HEIGHT - 10));
            ctx.lineTo(x, Math.max(10, y));
        });
        ctx.stroke();
    }
};

// --- INIT ---
document.getElementById('spelling-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') GameplayEngine.checkSpelling();
});
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = () => GameplayEngine.setupVoices();
window.onload = () => {
    initTheme();
    normalizeData();
    CurriculumEngine.renderPortal();
    GameplayEngine.setupVoices();
    const pinIn = document.getElementById('pinInput');
    if (pinIn) {
        pinIn.addEventListener('input', (e) => {
            e.target.style.width = ((e.target.value.length * 40) + 60) + 'px';
        });
        pinIn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') SecurityEngine.handlePinSubmit();
        });
    }
};
window.onerror = (m) => {
    console.error(m);
    return false;
};