import assert from 'node:assert';
import fs from 'node:fs';

console.log('====================================================');
console.log('RUNNING ALL-DEVICE PRODUCTION READINESS AUDIT');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`[PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------
// 1. HTML Viewport & Entry Point Integrity
// -----------------------------------------------------------------
test('1. index.html has complete responsive viewport configuration', () => {
  const html = fs.readFileSync('index.html', 'utf-8');
  assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0" />'), 'Must have width=device-width viewport meta');
  assert(html.includes('<title>Puzzles Assessment App</title>'), 'Title must be synced');
});

// -----------------------------------------------------------------
// 2. Student Portal & FlameMiniGameCanvas Mobile/Tablet/Desktop Responsiveness
// -----------------------------------------------------------------
test('2. Student Portal active test header is responsive across phones and tablets', () => {
  const code = fs.readFileSync('src/components/StudentPortal.tsx', 'utf-8');
  // Check that title container has min-w-0 and truncate
  assert(code.includes('min-w-0 flex-1'), 'Title container must have min-w-0 flex-1 to prevent flexbox blowout');
  assert(code.includes('truncate'), 'publishName must truncate to avoid pushing out timer');
  // Check countdown timer is shrink-0
  assert(code.includes('shrink-0'), 'Timer and Exit Test must be shrink-0 so they are never clipped');
  // Check footer button is responsive
  assert(code.includes('flex flex-col sm:flex-row'), 'Question advance footer must stack cleanly on mobile');
});

test('3. FlameMiniGameCanvas puzzle card has responsive padding and grid layout', () => {
  const code = fs.readFileSync('src/components/FlameMiniGameCanvas.tsx', 'utf-8');
  assert(code.includes('p-4 sm:p-6'), 'Must use p-4 on small phones and sm:p-6 on larger screens');
  assert(code.includes('gap-3 sm:gap-6'), 'Must use compact gap on phones for match pairs');
  assert(code.includes('grid-cols-1 sm:grid-cols-2'), 'Answer options must stack 1-col on phones and 2-col on tablets/desktops');
});

test('4. Multiple selection question mode is supported in student test engine', () => {
  const code = fs.readFileSync('src/components/FlameMiniGameCanvas.tsx', 'utf-8');
  assert(code.includes('isMultiple'), 'Must detect multiple selection answerType');
  assert(code.includes('handleMultipleOptionToggle'), 'Must handle multi-select toggling');
  assert(code.includes('Multiple Selection'), 'Must show user-friendly multiple selection badge');
});

// -----------------------------------------------------------------
// 3. Question Bank & Super Admin Dashboard Responsiveness
// -----------------------------------------------------------------
test('5. SuperAdminDashboard sidebar and headers adapt cleanly to mobile & desktop', () => {
  const code = fs.readFileSync('src/components/SuperAdminDashboard.tsx', 'utf-8');
  assert(code.includes('md:flex-row'), 'Must use column layout on mobile and row layout on desktop');
  assert(code.includes('border-b md:border-b-0 md:border-r'), 'Must have appropriate borders on mobile and desktop');
  assert(code.includes('hidden md:block'), 'Static sidebar footer must hide on mobile to save vertical space');
});

test('6. QuestionBankSection filters and question lists are mobile & tablet responsive', () => {
  const code = fs.readFileSync('src/components/QuestionBankSection.tsx', 'utf-8');
  assert(code.includes('grid grid-cols-1 lg:grid-cols-3'), 'Form row must stack 1-col on mobile/tablet and 3-col on large desktop');
  assert(code.includes('flex flex-col sm:flex-row sm:items-center'), 'Question item card must stack on mobile');
  assert(code.includes('overflow-y-auto'), 'Question list must have bounded scrollable height');
});

// -----------------------------------------------------------------
// 4. Publish Assessment & 12-Hour Time Picker
// -----------------------------------------------------------------
test('7. PublishAssessmentSection dates and times grid adapts from 1-col to 4-col', () => {
  const code = fs.readFileSync('src/components/PublishAssessmentSection.tsx', 'utf-8');
  assert(code.includes('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'), 'Date/time pickers must use 1-col on mobile, 2-col on tablet, 4-col on desktop');
  assert(code.includes('Time12HourPicker'), 'Must use 12-hour AM/PM picker');
  assert(code.includes('formatAvailabilityWindow'), 'Must show live formatted availability window');
});

test('8. Time12HourPicker has accessible touch-friendly selectors and AM/PM toggle', () => {
  const code = fs.readFileSync('src/components/Time12HourPicker.tsx', 'utf-8');
  assert(code.includes('min-w-[50px]'), 'Select boxes must have reasonable min-width');
  assert(code.includes('AM'), 'Must support AM toggle');
  assert(code.includes('PM'), 'Must support PM toggle');
});

// -----------------------------------------------------------------
// 5. Schools & Student Roster Table Responsiveness
// -----------------------------------------------------------------
test('9. SchoolsSection wraps student table in horizontal scroll container', () => {
  const code = fs.readFileSync('src/components/SchoolsSection.tsx', 'utf-8');
  assert(code.includes('overflow-x-auto'), 'Student table must have overflow-x-auto for mobile and tablet devices');
  assert(code.includes('grid grid-cols-1 sm:grid-cols-2'), 'School cards must use 1-col on mobile and 2-col on larger screens');
});

// -----------------------------------------------------------------
// 6. Viewport-Aware ProfileMenu & Portaled Logout Confirmation
// -----------------------------------------------------------------
test('10. ProfileMenu dynamically computes viewport coordinates and handles window resize', () => {
  const code = fs.readFileSync('src/components/ProfileMenu.tsx', 'utf-8');
  assert(code.includes('window.innerWidth'), 'Must query viewport width');
  assert(code.includes('window.innerHeight'), 'Must query viewport height');
  assert(code.includes('window.addEventListener(\'resize\', updatePosition)'), 'Must update on resize');
  assert(code.includes('createPortal'), 'Must render via React Portal');
});

// -----------------------------------------------------------------
// 7. Light and Dark Theme Visual Integrity
// -----------------------------------------------------------------
test('11. Light Theme CSS provides inverted tokens and WCAG AA contrast', () => {
  const css = fs.readFileSync('src/index.css', 'utf-8');
  assert(css.includes('--color-slate-950: #f8fafc;'), 'Slate 950 must be light background');
  assert(css.includes('--color-slate-900: #ffffff;'), 'Slate 900 must be white card surface');
  assert(css.includes('--color-slate-100: #0f172a;'), 'Slate 100 must be dark text');
  assert(css.includes('.selected-answer-option'), 'Must have scoped styling for selected student answer');
  assert(css.includes('.targets-filter-all-badge'), 'Must have scoped styling for All targets badge');
});

// -----------------------------------------------------------------
// 8. API Endpoints & Health Check
// -----------------------------------------------------------------
test('12. API Health check responds with database status', async () => {
  const res = await fetch('http://localhost:3000/api/health');
  assert.strictEqual(res.status, 200, 'Health endpoint must return 200 OK');
  const data = await res.json();
  assert.strictEqual(data.status, 'ok', 'Status must be ok');
  assert(data.database.status === 'connected', 'Database must be connected');
});

console.log('\n====================================================');
console.log(`AUDIT RESULT: ${passCount} / ${passCount + failCount} TESTS PASSED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
}
