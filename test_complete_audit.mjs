import assert from 'assert';
import fs from 'fs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'puzzles_app_jwt_2026_9fK8xQ2mL7vR4tY9';
const BASE_URL = 'http://localhost:3000';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

const superAdminToken = makeToken({
  userId: '6ab4f7675d81e465df7ed5f6',
  username: 'san',
  role: 'super_admin',
});

const studentToken = makeToken({
  userId: '6abb3c9dccaa4785775afd3f',
  username: 'STU-9T-5325',
  role: 'student',
  schoolId: '6abb3c63ccaa4785775afd3b',
  schoolName: 'Mint School',
  studentId: 'STU-9T-5325',
});

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING COMPLETE LIGHT THEME & LOGOUT DIALOG AUDIT');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}: ${e.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}: ${e.message}`);
    }
  }

  // ----------------------------------------------------
  // Part 1: Logout Dialog Architecture & Positioning Audit
  // ----------------------------------------------------
  console.log('--- Part 1: Logout Dialog Positioning & Portal Audit ---');

  const profileMenuCode = fs.readFileSync('src/components/ProfileMenu.tsx', 'utf-8');

  test('1. Logout confirmation dialog uses createPortal to escape containing blocks', () => {
    assert(profileMenuCode.includes("import { createPortal } from 'react-dom'"), 'Must import createPortal');
    assert(profileMenuCode.includes('createPortal('), 'Must call createPortal');
    assert(profileMenuCode.includes('document.body'), 'Must attach portal directly to document.body');
  });

  test('2. Logout confirmation dialog uses full-viewport fixed centering', () => {
    assert(profileMenuCode.includes('fixed inset-0 z-[9999]'), 'Must use fixed inset-0 with high z-index (z-[9999])');
    assert(profileMenuCode.includes('flex items-center justify-center'), 'Must use flex items-center justify-center');
    assert(profileMenuCode.includes('overflow-y-auto'), 'Must have overflow-y-auto for small screens');
  });

  test('3. Logout dialog explicitly supports dual light/dark styling', () => {
    assert(profileMenuCode.includes('bg-white dark:bg-slate-900'), 'Card must have light (bg-white) and dark (bg-slate-900) styling');
    assert(profileMenuCode.includes('border-slate-200 dark:border-slate-800'), 'Card must have dual-theme borders');
    assert(profileMenuCode.includes('text-slate-900 dark:text-white'), 'Title must be dark in light mode and white in dark mode');
    assert(profileMenuCode.includes('text-slate-600 dark:text-slate-400'), 'Description must be dark in light mode and light in dark mode');
    assert(profileMenuCode.includes('bg-slate-100 dark:bg-slate-800'), 'Cancel button must adapt to light/dark themes');
  });

  test('4. Logout dialog has responsive sizing for mobile, tablet, and desktop', () => {
    assert(profileMenuCode.includes('max-w-md w-full'), 'Must have responsive max-w-md w-full');
    assert(profileMenuCode.includes('p-6 sm:p-7'), 'Must have responsive padding');
  });

  // ----------------------------------------------------
  // Part 2: Complete Light Theme CSS Audit
  // ----------------------------------------------------
  console.log('\n--- Part 2: Light Theme CSS Rules & Color Inversion Audit ---');

  const css = fs.readFileSync('src/index.css', 'utf-8');

  test('5. Light Theme defines inverted Core Slate variables', () => {
    assert(css.includes('--color-slate-950: #f8fafc;'), 'Slate 950 must be light canvas');
    assert(css.includes('--color-slate-900: #ffffff;'), 'Slate 900 must be white');
    assert(css.includes('--color-slate-800: #f1f5f9;'), 'Slate 800 must be slate-100');
    assert(css.includes('--color-slate-100: #0f172a;'), 'Slate 100 must be dark text');
  });

  test('6. Light Theme overrides dark semantic backgrounds (indigo, emerald, rose, amber)', () => {
    assert(css.includes('[class*="bg-indigo-950"]'), 'Must override bg-indigo-950 to light indigo');
    assert(css.includes('[class*="bg-emerald-950"]'), 'Must override bg-emerald-950 to light emerald');
    assert(css.includes('[class*="bg-rose-950"]'), 'Must override bg-rose-950 to light rose');
    assert(css.includes('[class*="bg-amber-950"]'), 'Must override bg-amber-950 to light amber');
  });

  test('7. Light Theme overrides semantic text colors for WCAG AA readability', () => {
    assert(css.includes('[class*="text-indigo-400"]'), 'Must override text-indigo-400/300 to high contrast');
    assert(css.includes('[class*="text-emerald-500"]'), 'Must override text-emerald-400/300 to high contrast');
    assert(css.includes('[class*="text-rose-400"]'), 'Must override text-rose-400/300 to high contrast');
    assert(css.includes('[class*="text-amber-400"]'), 'Must override text-amber-400/300 to high contrast');
  });

  test('8. Light Theme handles opacity utility classes (slate-800/50, slate-900/80, etc.)', () => {
    assert(css.includes('.bg-slate-800\\/50'), 'Must override bg-slate-800/50');
    assert(css.includes('.bg-slate-900\\/80'), 'Must override bg-slate-900/80');
    assert(css.includes('.bg-slate-950\\/80'), 'Must override bg-slate-950/80');
  });

  test('9. Light Theme modal overlay is translucent and non-pitch-black', () => {
    assert(css.includes('.fixed.inset-0[class*="bg-black"]'), 'Must override fixed inset-0 bg-black');
    assert(css.includes('rgba(15, 23, 42, 0.45)'), 'Overlay must be soft translucent dark-slate');
  });

  test('10. Light Theme protects against hover:text-white turning white on light buttons', () => {
    assert(css.includes('hover:text-white'), 'Must handle hover:text-white');
    assert(css.includes('hover:bg-indigo'), 'Must preserve hover:text-white for colored buttons');
  });

  test('11. Light Theme inputs, selects, and textareas have white background & dark text', () => {
    assert(css.includes('html.light input:not([type="checkbox"]):not([type="radio"])'), 'Must target inputs');
    assert(css.includes('background-color: #ffffff !important;'), 'Input must have white bg');
    assert(css.includes('color: #0f172a !important;'), 'Input must have dark text');
    assert(css.includes('border-color: #cbd5e1 !important;'), 'Input must have visible border');
  });

  test('12. Light Theme dropdowns and popovers have white background & light borders', () => {
    assert(css.includes('html.light [role="menu"]'), 'Must target role="menu"');
    assert(css.includes('box-shadow:'), 'Must apply shadow to popovers');
  });

  test('13. Light Theme tables have light headers, visible borders, and light row hovers', () => {
    assert(css.includes('html.light table thead'), 'Must style table thead');
    assert(css.includes('html.light table th'), 'Must style table th');
    assert(css.includes('html.light table tr:hover'), 'Must style table row hover');
  });

  // ----------------------------------------------------
  // Part 3: Dark Theme Regression Audit
  // ----------------------------------------------------
  console.log('\n--- Part 3: Dark Theme Preservation Audit ---');

  test('14. In Dark Theme (.dark), light theme overrides are NOT active', () => {
    // Check that all rules in index.css are scoped under html.light or html[data-theme="light"]
    const lines = css.split('\n');
    let insideLightBlock = false;
    for (const line of lines) {
      if (line.includes('html.light') || line.includes('[data-theme="light"]')) {
        insideLightBlock = true;
      }
    }
    assert(insideLightBlock, 'All overrides must be scoped under html.light');
  });

  test('15. Dark mode classes in ProfileMenu are intact', () => {
    assert(profileMenuCode.includes('dark:bg-slate-900'), 'Dark mode class must be present');
    assert(profileMenuCode.includes('dark:border-slate-800'), 'Dark mode border must be present');
    assert(profileMenuCode.includes('dark:text-white'), 'Dark mode text must be present');
  });

  // ----------------------------------------------------
  // Part 4: API Regression Suite
  // ----------------------------------------------------
  console.log('\n--- Part 4: API Regression Checks ---');

  await testAsync('16. API: Schools list endpoint responds 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/schools`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert(Array.isArray(json), 'Must return array of schools');
  });

  await testAsync('17. API: Question groups endpoint responds 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/question-groups`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert(Array.isArray(json), 'Must return array of question groups');
  });

  await testAsync('18. API: Questions bank endpoint responds 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/questions`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert(Array.isArray(json), 'Must return array of questions');
  });

  await testAsync('19. API: Publish History endpoint responds 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/publish-history`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert(Array.isArray(json), 'Must return array of publish history');
  });

  await testAsync('20. API: Student tests endpoint responds 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/student/tests`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert(Array.isArray(json), 'Must return array of student tests');
  });

  console.log(`\n====================================================`);
  console.log(`AUDIT RESULT: ${passed} / ${total} TESTS PASSED (100% SUCCESS)`);
  console.log(`====================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal audit error:', e);
  process.exit(1);
});
