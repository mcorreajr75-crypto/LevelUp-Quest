/**
 * LevelUp Quest - Node.js Logic Tests
 * Tests pure functions and game logic that have no browser API dependencies.
 */

// ─── Mini test runner ────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`  ✅ ${description}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ ${description}`);
        console.error(`     ${e.message}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            (message ? message + ': ' : '') +
            `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
    }
}

function assertDeepEqual(actual, expected, message) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) {
        throw new Error(
            (message ? message + ': ' : '') +
            `expected ${b}, got ${a}`
        );
    }
}

// ─── Functions under test (copied from app.js — no browser deps) ─────────────

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function adjustColor(color, amount) {
    if (!color) return "#cccccc";
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(color)) return color;
    return '#' + color.replace(/^#/, '').replace(/../g, c =>
        ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).substr(-2)
    );
}

class SpellingGameLogic {
    constructor(wordList) {
        this.list = wordList;
        this.currentIndex = 0;
        this.wrongCount = 0;
        this.wordStartTime = Date.now();
        this.sessionMedals = { gold: 0, silver: 0, bronze: 0 };
        this.isPaused = false;
    }
    getCurrentWord() { return this.list[this.currentIndex] || null; }
    resetTimer() { this.wordStartTime = Date.now(); }
    togglePause() { this.isPaused = !this.isPaused; return this.isPaused; }
    evaluateGuess(inputVal) {
        if (this.isPaused) return { status: 'PAUSED' };
        const target = this.getCurrentWord().w;
        const cleanInput = inputVal.trim().toLowerCase();
        if (cleanInput === target) {
            const timeTaken = (Date.now() - this.wordStartTime) / 1000;
            let medalType = 'bronze';
            if (timeTaken < 5) { this.sessionMedals.gold++; medalType = 'gold'; }
            else if (timeTaken < 10) { this.sessionMedals.silver++; medalType = 'silver'; }
            else { this.sessionMedals.bronze++; }
            const wasFirstTry = (this.wrongCount === 0);
            return {
                status: 'CORRECT', word: target, timeTaken,
                medal: medalType, firstTry: wasFirstTry,
                isSessionComplete: (this.currentIndex + 1 >= this.list.length)
            };
        } else {
            this.wrongCount++;
            const attemptsLeft = 5 - this.wrongCount;
            if (attemptsLeft <= 0) {
                return { status: 'REVEAL', word: target, isSessionComplete: (this.currentIndex + 1 >= this.list.length) };
            }
            return { status: 'INCORRECT', attemptsLeft, showHelp: (this.wrongCount >= 4) };
        }
    }
    advance() { this.currentIndex++; this.wrongCount = 0; this.resetTimer(); return this.getCurrentWord(); }
}

// LicenseEngine with mock AppState
function makeLicenseEngine(licenseType, students) {
    const AppState = { data: { config: { licenseType }, students } };
    const alerts = [];
    function showAlertModal(msg) { alerts.push(msg); }
    const engine = {
        tiers: {
            FREE:          { maxStudents: 1,  maxListsPerStudent: 3,   label: 'Free Version' },
            STANDARD_PACK: { maxStudents: 6,  maxListsPerStudent: 8,   label: 'Standard License' },
            EDUCATOR:      { maxStudents: 50, maxListsPerStudent: 999, label: 'Educator Pro' },
        },
        getCurrentLimits() {
            return this.tiers[AppState.data.config.licenseType || 'FREE'];
        },
        canProceed(action, studentId = null) {
            const limits = this.getCurrentLimits();
            if (action === 'add_student') {
                if (Object.keys(AppState.data.students).length >= limits.maxStudents) {
                    showAlertModal('limit');
                    return false;
                }
            }
            if (action === 'add_list' && studentId) {
                const student = AppState.data.students[studentId];
                const count = Object.keys(student.lists || {}).length;
                if (count >= limits.maxListsPerStudent) {
                    showAlertModal('limit');
                    return false;
                }
            }
            return true;
        }
    };
    return { engine, alerts };
}

// Accuracy clamping (fixed formula)
function calcAccuracy(missed) {
    return Math.max(0, 100 - (missed * 10));
}

// weeklyGoal type fix
function parseStudentProp(p, v) {
    return p === 'weeklyGoal' ? Number(v) : v;
}

// toggleArch initialisation fix
function makeListConfig(existing) {
    if (!existing) return { visible: true };
    return existing;
}

// normalizeData minimal logic
function normalizeStudents(students) {
    Object.keys(students).forEach(n => {
        const s = students[n];
        if (!s.history)       s.history = {};
        if (!s.listConfigs)   s.listConfigs = {};
        if (!s.goalHistory)   s.goalHistory = [];
        if (!s.sentences)     s.sentences = {};
        if (s.weeklyGoal === undefined) s.weeklyGoal = 10;
        if (s.weeklyProgress === undefined) s.weeklyProgress = 0;
        if (!s.role)  s.role = 'Hero';
        if (!s.medals) s.medals = { gold: 0, silver: 0, bronze: 0 };
    });
    return students;
}

// processListImport validation (pure part)
function validateListImport(data) {
    if (!data || data.type !== 'levelup-list') return { valid: false, reason: 'bad type' };
    if (!Array.isArray(data.words))            return { valid: false, reason: 'missing words' };
    if (typeof data.name !== 'string' || !data.name.trim()) return { valid: false, reason: 'missing name' };
    return { valid: true };
}

// ─── Test suites ─────────────────────────────────────────────────────────────

console.log('\n📋 escHtml');
test('escapes ampersand', () => assertEqual(escHtml('Tom&Jerry'), 'Tom&amp;Jerry'));
test('escapes less-than', () => assertEqual(escHtml('<script>'), '&lt;script&gt;'));
test('escapes double quote', () => assertEqual(escHtml('"hello"'), '&quot;hello&quot;'));
test('escapes single quote', () => assertEqual(escHtml("it's"), 'it&#39;s'));
test('leaves safe strings unchanged', () => assertEqual(escHtml('Hello World 123'), 'Hello World 123'));
test('coerces non-string input', () => assertEqual(escHtml(42), '42'));
test('handles empty string', () => assertEqual(escHtml(''), ''));
test('XSS onclick injection attempt', () => {
    const name = "'); alert(1) //";
    const escaped = escHtml(name);
    assert(!escaped.includes('<'), 'should not contain <');
    assert(!escaped.includes('>'), 'should not contain >');
});

console.log('\n🎨 adjustColor');
test('darkens a hex colour', () => {
    const result = adjustColor('#4ECDC4', -20);
    assert(result.startsWith('#'), 'should return hex');
    assert(result !== '#4ECDC4', 'should be different from input');
});
test('lightens a hex colour', () => {
    const result = adjustColor('#4ECDC4', 20);
    assert(result.startsWith('#'), 'should return hex');
});
test('clamps at #000000 when darkening black', () => {
    assertEqual(adjustColor('#000000', -50), '#000000');
});
test('clamps at #ffffff when lightening white', () => {
    assertEqual(adjustColor('#ffffff', 50), '#ffffff');
});
test('returns fallback for null input', () => {
    assertEqual(adjustColor(null, -20), '#cccccc');
});
test('returns input unchanged for non-hex string', () => {
    assertEqual(adjustColor('red', -20), 'red');
});

console.log('\n🎮 SpellingGameLogic — basic flow');
const wordList = [
    { w: 'cat', s: 'The cat sat on the mat.' },
    { w: 'dog', s: 'The dog wagged its tail.' },
    { w: 'hat', s: 'She wore a red hat.' },
];

test('getCurrentWord returns first word', () => {
    const g = new SpellingGameLogic(wordList);
    assertEqual(g.getCurrentWord().w, 'cat');
});
test('correct guess returns CORRECT status', () => {
    const g = new SpellingGameLogic(wordList);
    const r = g.evaluateGuess('cat');
    assertEqual(r.status, 'CORRECT');
});
test('correct guess is case-insensitive', () => {
    const g = new SpellingGameLogic(wordList);
    assertEqual(g.evaluateGuess('CAT').status, 'CORRECT');
});
test('correct guess trims whitespace', () => {
    const g = new SpellingGameLogic(wordList);
    assertEqual(g.evaluateGuess('  cat  ').status, 'CORRECT');
});
test('first-try bonus flagged', () => {
    const g = new SpellingGameLogic(wordList);
    assert(g.evaluateGuess('cat').firstTry === true, 'should be first try');
});
test('first-try bonus lost after a wrong guess', () => {
    const g = new SpellingGameLogic(wordList);
    g.evaluateGuess('xyz');
    assert(g.evaluateGuess('cat').firstTry === false, 'should not be first try');
});
test('wrong guess returns INCORRECT and decrements attempts', () => {
    const g = new SpellingGameLogic(wordList);
    const r = g.evaluateGuess('xyz');
    assertEqual(r.status, 'INCORRECT');
    assertEqual(r.attemptsLeft, 4);
});
test('showHelp flag appears on 4th wrong guess', () => {
    const g = new SpellingGameLogic(wordList);
    g.evaluateGuess('x'); g.evaluateGuess('x'); g.evaluateGuess('x');
    const r = g.evaluateGuess('x');
    assertEqual(r.status, 'INCORRECT');
    assert(r.showHelp === true, 'showHelp should be true');
});
test('5th wrong guess triggers REVEAL', () => {
    const g = new SpellingGameLogic(wordList);
    for (let i = 0; i < 4; i++) g.evaluateGuess('x');
    const r = g.evaluateGuess('x');
    assertEqual(r.status, 'REVEAL');
    assertEqual(r.word, 'cat');
});
test('advance moves to next word', () => {
    const g = new SpellingGameLogic(wordList);
    g.evaluateGuess('cat');
    g.advance();
    assertEqual(g.getCurrentWord().w, 'dog');
});
test('isSessionComplete true on last word', () => {
    const g = new SpellingGameLogic([{ w: 'only', s: '' }]);
    const r = g.evaluateGuess('only');
    assert(r.isSessionComplete === true, 'should be complete');
});
test('isSessionComplete false when words remain', () => {
    const g = new SpellingGameLogic(wordList);
    const r = g.evaluateGuess('cat');
    assert(r.isSessionComplete === false, 'should not be complete');
});
test('pause blocks evaluateGuess', () => {
    const g = new SpellingGameLogic(wordList);
    g.togglePause();
    assertEqual(g.evaluateGuess('cat').status, 'PAUSED');
});
test('unpause allows guesses again', () => {
    const g = new SpellingGameLogic(wordList);
    g.togglePause();
    g.togglePause();
    assertEqual(g.evaluateGuess('cat').status, 'CORRECT');
});

console.log('\n🎮 SpellingGameLogic — medal timing');
test('gold medal for guess < 5s', () => {
    const g = new SpellingGameLogic(wordList);
    g.wordStartTime = Date.now() - 2000; // 2s ago
    const r = g.evaluateGuess('cat');
    assertEqual(r.medal, 'gold');
    assertEqual(g.sessionMedals.gold, 1);
});
test('silver medal for guess 5–10s', () => {
    const g = new SpellingGameLogic(wordList);
    g.wordStartTime = Date.now() - 7000; // 7s ago
    const r = g.evaluateGuess('cat');
    assertEqual(r.medal, 'silver');
    assertEqual(g.sessionMedals.silver, 1);
});
test('bronze medal for guess > 10s', () => {
    const g = new SpellingGameLogic(wordList);
    g.wordStartTime = Date.now() - 15000; // 15s ago
    const r = g.evaluateGuess('cat');
    assertEqual(r.medal, 'bronze');
    assertEqual(g.sessionMedals.bronze, 1);
});

console.log('\n🔒 LicenseEngine');
test('FREE tier blocks adding 2nd student', () => {
    const { engine, alerts } = makeLicenseEngine('FREE', { Alice: {} });
    assert(!engine.canProceed('add_student'), 'should block');
    assert(alerts.length > 0, 'should alert');
});
test('FREE tier allows adding 1st student', () => {
    const { engine } = makeLicenseEngine('FREE', {});
    assert(engine.canProceed('add_student'), 'should allow');
});
test('STANDARD_PACK allows up to 6 students', () => {
    const students = {};
    for (let i = 0; i < 5; i++) students[`Student${i}`] = {};
    const { engine } = makeLicenseEngine('STANDARD_PACK', students);
    assert(engine.canProceed('add_student'), 'should allow 6th');
});
test('STANDARD_PACK blocks 7th student', () => {
    const students = {};
    for (let i = 0; i < 6; i++) students[`Student${i}`] = {};
    const { engine, alerts } = makeLicenseEngine('STANDARD_PACK', students);
    assert(!engine.canProceed('add_student'), 'should block');
    assert(alerts.length > 0, 'should alert');
});
test('FREE tier blocks adding 4th list', () => {
    const students = { Alice: { lists: { L1: [], L2: [], L3: [] } } };
    const { engine, alerts } = makeLicenseEngine('FREE', students);
    assert(!engine.canProceed('add_list', 'Alice'), 'should block');
    assert(alerts.length > 0, 'should alert');
});
test('FREE tier allows adding 3rd list', () => {
    const students = { Alice: { lists: { L1: [], L2: [] } } };
    const { engine } = makeLicenseEngine('FREE', students);
    assert(engine.canProceed('add_list', 'Alice'), 'should allow');
});
test('EDUCATOR tier effectively unlimited lists', () => {
    const lists = {};
    for (let i = 0; i < 50; i++) lists[`List${i}`] = [];
    const students = { Alice: { lists } };
    const { engine } = makeLicenseEngine('EDUCATOR', students);
    assert(engine.canProceed('add_list', 'Alice'), 'should allow');
});

console.log('\n🐛 Bug fixes');
test('weeklyGoal input string "10" is parsed to number 10', () => {
    const result = parseStudentProp('weeklyGoal', '10');
    assertEqual(typeof result, 'number');
    assertEqual(result, 10);
});
test('weeklyGoal strict equality works after fix (10 === 10)', () => {
    const goal = parseStudentProp('weeklyGoal', '10');
    assert(10 === goal, 'strict equality should pass');
});
test('non-numeric props are not coerced', () => {
    assertEqual(parseStudentProp('color', '#ff0000'), '#ff0000');
    assertEqual(parseStudentProp('role', 'Hero'), 'Hero');
});
test('toggleArch: new listConfig initialises with visible:true so first toggle hides', () => {
    const config = makeListConfig(undefined);
    assert(config.visible === true, 'new entry should be visible:true');
    config.visible = !config.visible;
    assert(config.visible === false, 'after first toggle should be hidden');
});
test('toggleArch: existing visible:true toggles to false', () => {
    const config = makeListConfig({ visible: true });
    config.visible = !config.visible;
    assert(config.visible === false);
});
test('toggleArch: existing visible:false toggles to true', () => {
    const config = makeListConfig({ visible: false });
    config.visible = !config.visible;
    assert(config.visible === true);
});
test('accuracy chart clamps at 0 (not negative)', () => {
    assertEqual(calcAccuracy(15), 0);  // 100 - 150 would be -50 without clamp
    assertEqual(calcAccuracy(10), 0);  // 100 - 100 = 0
    assertEqual(calcAccuracy(11), 0);  // would be -10 without clamp
});
test('accuracy chart correct for low miss counts', () => {
    assertEqual(calcAccuracy(0), 100);
    assertEqual(calcAccuracy(1), 90);
    assertEqual(calcAccuracy(5), 50);
});

console.log('\n🔍 normalizeData — student defaults');
test('adds missing history field', () => {
    const s = normalizeStudents({ Alice: {} });
    assertDeepEqual(s.Alice.history, {});
});
test('adds missing medals field', () => {
    const s = normalizeStudents({ Alice: {} });
    assertDeepEqual(s.Alice.medals, { gold: 0, silver: 0, bronze: 0 });
});
test('defaults weeklyGoal to 10', () => {
    const s = normalizeStudents({ Alice: {} });
    assertEqual(s.Alice.weeklyGoal, 10);
});
test('defaults role to Hero', () => {
    const s = normalizeStudents({ Alice: {} });
    assertEqual(s.Alice.role, 'Hero');
});
test('does not overwrite existing fields', () => {
    const s = normalizeStudents({ Alice: { weeklyGoal: 20, role: 'Wizard' } });
    assertEqual(s.Alice.weeklyGoal, 20);
    assertEqual(s.Alice.role, 'Wizard');
});

console.log('\n📥 List import validation');
test('valid import passes', () => {
    assert(validateListImport({ type: 'levelup-list', name: 'Week 1', words: ['cat', 'dog'] }).valid);
});
test('wrong type is rejected', () => {
    assert(!validateListImport({ type: 'other', name: 'Week 1', words: [] }).valid);
});
test('missing words array is rejected', () => {
    assert(!validateListImport({ type: 'levelup-list', name: 'Week 1' }).valid);
});
test('missing name is rejected', () => {
    assert(!validateListImport({ type: 'levelup-list', name: '', words: [] }).valid);
});
test('null input is rejected', () => {
    assert(!validateListImport(null).valid);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(45)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('  ⚠️  Some tests failed.');
    process.exit(1);
} else {
    console.log('  🎉 All tests passed!');
}
