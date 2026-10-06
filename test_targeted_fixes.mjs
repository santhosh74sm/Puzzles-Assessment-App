import assert from 'assert';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'puzzles_app_jwt_2026_9fK8xQ2mL7vR4tY9';
const BASE_URL = 'http://localhost:3000';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

const superAdminToken = makeToken({
  userId: '6ab4f7675d81e465df7ed5f6',
  username: 'superadmin_audit',
  role: 'super_admin',
});

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function run() {
  console.log('====================================================');
  console.log('TARGETED VERIFICATION TEST FOR THE 3 AUDIT FIXES');
  console.log('====================================================\n');

  // Fetch school
  const schoolsRes = await fetch(`${BASE_URL}/api/schools`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const schools = await schoolsRes.json();
  assert(schools.length > 0, 'At least one school must exist');
  const targetSchool = schools[0];
  console.log(`Target School: ${targetSchool.name} (${targetSchool.id})`);

  // ====================================================
  // ISSUE 1: PASSWORD HASH LEAK IN API RESPONSES
  // ====================================================
  console.log('\n--- ISSUE 1: PASSWORD HASH EXCLUSION VERIFICATION ---');

  let testStudentUser = null;
  let testStudentCredentials = null;

  await test('1.1: POST /api/students excludes passwordHash in response', async () => {
    const admissionNo = `ADM-TEST-${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        studentName: 'Audit Test Student',
        className: 'Class 9',
        section: 'A',
        schoolAdmissionNumber: admissionNo,
        schoolId: targetSchool.id,
      }),
    });
    const data = await createRes.json();
    assert.strictEqual(createRes.status, 201, `Expected 201, got ${createRes.status}: ${JSON.stringify(data)}`);
    assert(data.student, 'Expected student object');
    assert.strictEqual(data.student.passwordHash, undefined, 'passwordHash must be absent in POST /students response');

    // Also check serialized string does not contain passwordHash key
    const rawJson = JSON.stringify(data);
    assert(!rawJson.includes('"passwordHash"'), 'Serialized JSON must not contain passwordHash');

    testStudentUser = data.student;
    testStudentCredentials = data.credentials;
  });

  await test('1.2: PUT /api/students/:id excludes passwordHash in response', async () => {
    const updateRes = await fetch(`${BASE_URL}/api/students/${testStudentUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        studentName: 'Audit Test Student Updated',
        className: 'Class 9',
        section: 'B',
        schoolAdmissionNumber: testStudentUser.schoolAdmissionNumber,
      }),
    });
    const data = await updateRes.json();
    assert.strictEqual(updateRes.status, 200, `Expected 200, got ${updateRes.status}: ${JSON.stringify(data)}`);
    assert(data.student, 'Expected student object');
    assert.strictEqual(data.student.passwordHash, undefined, 'passwordHash must be absent in PUT /students/:id response');
    assert.strictEqual(data.student.studentName, 'Audit Test Student Updated');

    const rawJson = JSON.stringify(data);
    assert(!rawJson.includes('"passwordHash"'), 'Serialized JSON must not contain passwordHash');
  });

  await test('1.3: GET /api/reports/schools/:schoolId/students excludes passwordHash', async () => {
    const reportRes = await fetch(`${BASE_URL}/api/reports/schools/${targetSchool.id}/students`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const data = await reportRes.json();
    assert.strictEqual(reportRes.status, 200);
    assert(Array.isArray(data), 'Expected array of students');
    for (const s of data) {
      assert.strictEqual(s.passwordHash, undefined, `Student ${s.uniqueStudentId} leaked passwordHash`);
    }
    const rawJson = JSON.stringify(data);
    assert(!rawJson.includes('"passwordHash"'), 'Serialized student report list must not contain passwordHash');
  });

  await test('1.4: GET /api/students excludes passwordHash', async () => {
    const listRes = await fetch(`${BASE_URL}/api/students?schoolId=${targetSchool.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const data = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    assert(Array.isArray(data));
    for (const s of data) {
      assert.strictEqual(s.passwordHash, undefined, `Student ${s.uniqueStudentId} leaked passwordHash in /students`);
    }
    const rawJson = JSON.stringify(data);
    assert(!rawJson.includes('"passwordHash"'), 'Serialized /students response must not contain passwordHash');
  });

  await test('1.5: Student login, password verification, and change password work normally', async () => {
    // Student logs in with initial password
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testStudentCredentials.username,
        password: testStudentCredentials.initialPassword,
      }),
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, `Login should succeed: ${JSON.stringify(loginData)}`);
    assert(loginData.token, 'Token must be issued');
    assert.strictEqual(loginData.user.passwordHash, undefined, 'Login user object must not leak passwordHash');
    assert.strictEqual(loginData.user.mustChangePassword, true);

    const studentAuthToken = loginData.token;

    // Student changes password
    const newPassword = 'SecureStudentPassword2026!';
    const changeRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAuthToken}`,
      },
      body: JSON.stringify({ newPassword }),
    });
    const changeData = await changeRes.json();
    assert.strictEqual(changeRes.status, 200, `Change password should succeed: ${JSON.stringify(changeData)}`);

    // Student logs in with new password
    const reLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testStudentCredentials.username,
        password: newPassword,
      }),
    });
    const reLoginData = await reLoginRes.json();
    assert.strictEqual(reLoginRes.status, 200, 'Login with new password must succeed');
    assert.strictEqual(reLoginData.user.mustChangePassword, false);
  });

  // ====================================================
  // ISSUE 2 & 3: SETUP QUESTIONS & PUBLISH ASSESSMENT
  // ====================================================
  console.log('\n--- SETUP QUESTIONS AND PUBLISHED ASSESSMENTS ---');

  const groupsRes = await fetch(`${BASE_URL}/api/question-groups`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const groups = await groupsRes.json();
  const testGroup = groups[0];

  // Create 3 questions: 2 single choice, 1 multiple selection
  const q1Res = await fetch(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      groupId: testGroup.id,
      content: `What is 2 + 2? ${Date.now()}`,
      difficulty: 'Easy',
      points: 10,
      answerType: 'single',
      options: ['3', '4', '5'],
      correctAnswer: '4',
      timeSeconds: 30,
    }),
  });
  const q1 = await q1Res.json();

  const q2Res = await fetch(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      groupId: testGroup.id,
      content: `Which are prime numbers? ${Date.now()}`,
      difficulty: 'Medium',
      points: 20,
      answerType: 'multiple',
      options: ['2', '3', '4', '6'],
      correctAnswers: ['2', '3'],
      timeSeconds: 30,
    }),
  });
  const q2 = await q2Res.json();

  const q3Res = await fetch(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      groupId: testGroup.id,
      content: `What is the capital of France? ${Date.now()}`,
      difficulty: 'Easy',
      points: 10,
      answerType: 'single',
      options: ['London', 'Berlin', 'Paris'],
      correctAnswer: 'Paris',
      timeSeconds: 30,
    }),
  });
  const q3 = await q3Res.json();

  // Create published assessment
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const pubRes = await fetch(`${BASE_URL}/api/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      publishName: `Audit Test Assessment ${Date.now()}`,
      publishMode: 'Selected Questions',
      selectedQuestionIds: [q1.id, q2.id, q3.id],
      targets: [{
        schoolId: targetSchool.id,
        className: 'Class 9',
        sections: ['B'],
      }],
      startDate: todayStr,
      startTime: '12:00 AM',
      endDate: 'Open',
      endTime: '11:59 PM',
    }),
  });
  const pubData = await pubRes.json();
  assert.strictEqual(pubRes.status, 201, `Publish should succeed: ${JSON.stringify(pubData)}`);
  const publishedTestId = pubData.publishedTest.id;

  // Student auth token for test taking
  const studentToken = makeToken({
    userId: testStudentUser.id,
    username: testStudentUser.uniqueStudentId,
    role: 'student',
    schoolId: targetSchool.id,
    schoolName: targetSchool.name,
    studentId: testStudentUser.uniqueStudentId,
  });

  // Get student's assigned test
  const testsRes = await fetch(`${BASE_URL}/api/student/tests`, {
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'x-client-now': `${todayStr}T12:00`,
    },
  });
  const tests = await testsRes.json();
  const myAssignment = tests.find((t) => t.publishedTestId === publishedTestId);
  assert(myAssignment, 'Student must have assignment for the published test');

  // Start test
  const startRes = await fetch(`${BASE_URL}/api/student/tests/${myAssignment.assignmentId}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'x-client-now': `${todayStr}T12:00`,
    },
  });
  const startedTestData = await startRes.json();
  assert.strictEqual(startRes.status, 200, `Start test must succeed: ${JSON.stringify(startedTestData)}`);
  assert.strictEqual(startedTestData.questions.length, 3);

  // ====================================================
  // ISSUE 2: TIMER EXPIRY PRESERVES LATEST SELECTED ANSWER
  // ====================================================
  console.log('\n--- ISSUE 2: TIMER EXPIRY CAPTURES LATEST SELECTED ANSWER ---');

  await test('2.1: Single Selection - selected answer is saved on auto-advance / answer endpoint', async () => {
    // Student selected '4' before timer expiry
    const ansRes = await fetch(`${BASE_URL}/api/student/tests/${myAssignment.assignmentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        questionId: q1.id,
        answer: '4',
        timeTakenSeconds: 30, // timer expired
      }),
    });
    const ansData = await ansRes.json();
    assert.strictEqual(ansRes.status, 200);
    assert.strictEqual(ansData.isCorrect, true);
    assert.strictEqual(ansData.earnedPoints, 10);
  });

  await test('2.2: Multiple Selection - exact-set latest selected options are saved and scored', async () => {
    // Student selected ['2', '3'] before timer expiry
    const ansRes = await fetch(`${BASE_URL}/api/student/tests/${myAssignment.assignmentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        questionId: q2.id,
        answer: ['2', '3'],
        timeTakenSeconds: 30,
      }),
    });
    const ansData = await ansRes.json();
    assert.strictEqual(ansRes.status, 200);
    assert.strictEqual(ansData.isCorrect, true);
    assert.strictEqual(ansData.earnedPoints, 20);
  });

  await test('2.3: Final Question - timer expiry captures latest answer and final submission includes it', async () => {
    // Final question answered with 'Paris' when timer expired
    const submitRes = await fetch(`${BASE_URL}/api/student/tests/${myAssignment.assignmentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        answers: [
          { questionId: q1.id, answer: '4', timeTakenSeconds: 30 },
          { questionId: q2.id, answer: ['2', '3'], timeTakenSeconds: 30 },
          { questionId: q3.id, answer: 'Paris', timeTakenSeconds: 30 }, // Latest answer on timer expiry
        ],
      }),
    });
    const submitData = await submitRes.json();
    assert.strictEqual(submitRes.status, 200, `Submit should succeed: ${JSON.stringify(submitData)}`);
    assert.strictEqual(submitData.status, 'COMPLETED');
    assert.strictEqual(submitData.totalPointsEarned, 40); // 10 + 20 + 10 = 40
    assert.strictEqual(submitData.scoreOutOf100, 100);
    assert.strictEqual(submitData.correctCount, 3);
  });

  // ====================================================
  // ISSUE 3: EXPIRED & EXITED TEST PROTECTION
  // ====================================================
  console.log('\n--- ISSUE 3: EXPIRED & EXITED LIFECYCLE ENFORCEMENT ---');

  await test('3.1: Already COMPLETED test rejects further /answer requests', async () => {
    const res = await fetch(`${BASE_URL}/api/student/tests/${myAssignment.assignmentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        questionId: q1.id,
        answer: '3',
        timeTakenSeconds: 5,
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error.includes('no longer accepting answers') || data.error.includes('completed'));
  });

  await test('3.2: Already COMPLETED test rejects further /submit requests', async () => {
    const res = await fetch(`${BASE_URL}/api/student/tests/${myAssignment.assignmentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({ answers: [] }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error.includes('already been completed'));
  });

  // Test Explicit Exit
  await test('3.3: Exited test (INCOMPLETE/EXIT) rejects further answers and submissions', async () => {
    // Publish a 2nd test for explicit exit testing
    const pub2Res = await fetch(`${BASE_URL}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        publishName: `Audit Exit Test ${Date.now()}`,
        publishMode: 'Selected Questions',
        selectedQuestionIds: [q1.id, q2.id],
        targets: [{
          schoolId: targetSchool.id,
          className: 'Class 9',
          sections: ['B'],
        }],
        startDate: todayStr,
        startTime: '12:00 AM',
        endDate: 'Open',
        endTime: '11:59 PM',
      }),
    });
    const pub2Data = await pub2Res.json();
    const pub2Id = pub2Data.publishedTest.id;

    // Student gets assignment
    const list2Res = await fetch(`${BASE_URL}/api/student/tests`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
    });
    const list2 = await list2Res.json();
    const assign2 = list2.find((t) => t.publishedTestId === pub2Id);
    assert(assign2, 'Assignment 2 must exist');

    // Start test
    await fetch(`${BASE_URL}/api/student/tests/${assign2.assignmentId}/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
    });

    // Student explicitly exits
    const exitRes = await fetch(`${BASE_URL}/api/student/tests/${assign2.assignmentId}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ exitType: 'EXIT', reason: 'Student clicked exit button' }),
    });
    const exitData = await exitRes.json();
    assert.strictEqual(exitRes.status, 200);
    assert.strictEqual(exitData.status, 'INCOMPLETE');
    assert.strictEqual(exitData.exitType, 'EXIT');

    // Try posting answer -> MUST BE REJECTED (400)
    const postAnsRes = await fetch(`${BASE_URL}/api/student/tests/${assign2.assignmentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        questionId: q1.id,
        answer: '4',
        timeTakenSeconds: 10,
      }),
    });
    assert.strictEqual(postAnsRes.status, 400, 'Answer to exited test must be rejected with 400');
    const postAnsData = await postAnsRes.json();
    assert(postAnsData.error.includes('exited') || postAnsData.error.includes('not in progress'));

    // Try submitting -> MUST BE REJECTED (400)
    const postSubRes = await fetch(`${BASE_URL}/api/student/tests/${assign2.assignmentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        answers: [{ questionId: q1.id, answer: '4', timeTakenSeconds: 10 }],
      }),
    });
    assert.strictEqual(postSubRes.status, 400, 'Submit to exited test must be rejected with 400');
    const postSubData = await postSubRes.json();
    assert(postSubData.error.includes('exited') || postSubData.error.includes('ended'));

    // Verify assignment is still INCOMPLETE in DB
    const verifyListRes = await fetch(`${BASE_URL}/api/student/tests`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
    });
    const verifyList = await verifyListRes.json();
    const updatedAssign2 = verifyList.find((t) => t.publishedTestId === pub2Id);
    assert.strictEqual(updatedAssign2.status, 'INCOMPLETE', 'Status must remain INCOMPLETE');
    assert.strictEqual(updatedAssign2.exitType, 'EXIT', 'Exit type must remain EXIT');
  });

  // Test Expired Assessment
  await test('3.4: Expired test rejects /answer and /submit and cannot become COMPLETED', async () => {
    // Publish an assessment that expired yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

    const pub3Res = await fetch(`${BASE_URL}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        publishName: `Audit Expired Test ${Date.now()}`,
        publishMode: 'Selected Questions',
        selectedQuestionIds: [q1.id],
        targets: [{
          schoolId: targetSchool.id,
          className: 'Class 9',
          sections: ['B'],
        }],
        startDate: yesterdayStr,
        startTime: '08:00 AM',
        endDate: yesterdayStr,
        endTime: '10:00 AM',
      }),
    });
    const pub3Data = await pub3Res.json();
    const pub3Id = pub3Data.publishedTest.id;

    // Student checks tests
    const list3Res = await fetch(`${BASE_URL}/api/student/tests`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
    });
    const list3 = await list3Res.json();
    const assign3 = list3.find((t) => t.publishedTestId === pub3Id);
    assert(assign3, 'Assignment 3 must exist');

    // Attempting to submit answers to expired assessment -> REJECTED (400)
    const expAnsRes = await fetch(`${BASE_URL}/api/student/tests/${assign3.assignmentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        questionId: q1.id,
        answer: '4',
        timeTakenSeconds: 10,
      }),
    });
    assert.strictEqual(expAnsRes.status, 400, 'Answer to expired test must be rejected');
    const expAnsData = await expAnsRes.json();
    assert(expAnsData.error.includes('expired'), `Expected expired error, got ${JSON.stringify(expAnsData)}`);

    // Attempting to submit final answers to expired assessment -> REJECTED (400)
    const expSubRes = await fetch(`${BASE_URL}/api/student/tests/${assign3.assignmentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
      body: JSON.stringify({
        answers: [{ questionId: q1.id, answer: '4', timeTakenSeconds: 10 }],
      }),
    });
    assert.strictEqual(expSubRes.status, 400, 'Final submit to expired test must be rejected');
    const expSubData = await expSubRes.json();
    assert(expSubData.error.includes('expired'), `Expected expired error, got ${JSON.stringify(expSubData)}`);

    // Confirm it never became COMPLETED
    const checkRes = await fetch(`${BASE_URL}/api/student/tests`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-client-now': `${todayStr}T12:00`,
      },
    });
    const checkList = await checkRes.json();
    const checkedAssign3 = checkList.find((t) => t.publishedTestId === pub3Id);
    assert.notStrictEqual(checkedAssign3.status, 'COMPLETED', 'Expired assessment must not be COMPLETED');
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
