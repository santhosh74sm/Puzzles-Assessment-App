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

const adminHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${superAdminToken}`,
};

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
  console.log('FOCUSED VERIFICATION TEST: 2 TARGETED QUESTION BANK FIXES');
  console.log('====================================================\n');

  // 1. Setup School and Question Group
  const schoolsRes = await fetch(`${BASE_URL}/api/schools`, { headers: adminHeaders });
  const schools = await schoolsRes.json();
  const school = schools[0];
  const schoolId = school.id || school._id;

  const groupsRes = await fetch(`${BASE_URL}/api/question-groups`, { headers: adminHeaders });
  const groups = await groupsRes.json();
  const group = groups[0];
  const groupId = group.id || group._id;

  const uniqueSuffix = Date.now();

  // 2. Create Question X in Question Bank
  // Original version: "What is 2 + 2? <suffix>", options: ['3', '4', '5', '6'], correct: '4', points: 10, time: 30
  const qCreateRes = await fetch(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      groupId,
      difficulty: 'Easy',
      content: `What is 2 + 2? ${uniqueSuffix}`,
      points: 10,
      timeSeconds: 30,
      options: ['3', '4', '5', '6'],
      correctAnswer: '4',
      answerType: 'single',
    }),
  });
  assert.strictEqual(qCreateRes.status, 201, 'Failed to create test question');
  const questionX = await qCreateRes.json();
  const questionXId = questionX.id || questionX._id;
  console.log(`[SETUP] Created Question X: ID=${questionXId}, content="${questionX.content}", correct="4"`);

  // 3. Create Student A (will complete assessment) and Student B (will remain uncompleted)
  const studentAUsername = `st_fix_a_${uniqueSuffix}`;
  const studentBUsername = `st_fix_b_${uniqueSuffix}`;

  const createStudentARes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      schoolId,
      studentName: 'Student A (Completed Target)',
      className: 'Grade 6',
      section: 'A',
      schoolAdmissionNumber: `ADM-A-${uniqueSuffix}`,
      username: studentAUsername,
      password: 'StudentPassword123!',
    }),
  });
  assert.strictEqual(createStudentARes.status, 201, 'Failed to create Student A');
  const studentAData = await createStudentARes.json();
  const studentA = studentAData.student;
  const studentAId = studentA.uniqueStudentId || studentA.id;

  const createStudentBRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      schoolId,
      studentName: 'Student B (Uncompleted Target)',
      className: 'Grade 6',
      section: 'A',
      schoolAdmissionNumber: `ADM-B-${uniqueSuffix}`,
      username: studentBUsername,
      password: 'StudentPassword123!',
    }),
  });
  assert.strictEqual(createStudentBRes.status, 201, 'Failed to create Student B');
  const studentBData = await createStudentBRes.json();
  const studentB = studentBData.student;
  const studentBId = studentB.uniqueStudentId || studentB.id;

  const studentAToken = makeToken({
    userId: studentA.id || studentA._id,
    studentId: studentA.uniqueStudentId,
    username: studentA.uniqueStudentId,
    role: 'student',
    schoolId,
  });
  const studentAHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${studentAToken}`,
  };

  const studentBToken = makeToken({
    userId: studentB.id || studentB._id,
    studentId: studentB.uniqueStudentId,
    username: studentB.uniqueStudentId,
    role: 'student',
    schoolId,
  });
  const studentBHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${studentBToken}`,
  };

  // 4. Publish assessment containing Question X
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const pubRes = await fetch(`${BASE_URL}/api/publish`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      publishName: `Math Fix Test ${uniqueSuffix}`,
      publishMode: 'Selected Questions',
      selectedQuestionIds: [questionXId],
      targets: [{
        schoolId,
        className: 'Grade 6',
        sections: ['A'],
      }],
      startDate: todayStr,
      startTime: '12:00 AM',
      endDate: 'Open',
      endTime: '11:59 PM',
      shuffle: false,
    }),
  });
  const pubData = await pubRes.json();
  assert.strictEqual(pubRes.status, 201, `Failed to publish assessment: ${JSON.stringify(pubData)}`);
  const publishedTestId = pubData.publishedTest?.id || pubData.history?.publishId;
  console.log(`[SETUP] Published Assessment: ID=${publishedTestId}`);

  // Fetch Student A test assignment
  const studentATestsRes = await fetch(`${BASE_URL}/api/student/tests`, { headers: studentAHeaders });
  const studentATests = await studentATestsRes.json();
  const assignmentA = studentATests.find((t) => t.publishedTestId === publishedTestId);
  assert.ok(assignmentA, 'Assignment for Student A not found');
  const assignmentAId = assignmentA.assignmentId || assignmentA.id;

  // 5. Student A starts, answers Question X with "4", and completes/submits test
  const startARes = await fetch(`${BASE_URL}/api/student/tests/${assignmentAId}/start`, {
    method: 'POST',
    headers: studentAHeaders,
  });
  assert.strictEqual(startARes.status, 200, 'Student A start failed');
  const startAData = await startARes.json();
  assert.strictEqual(startAData.questions[0].content, `What is 2 + 2? ${uniqueSuffix}`);

  // Student A answers with "4"
  const answerARes = await fetch(`${BASE_URL}/api/student/tests/${assignmentAId}/answer`, {
    method: 'POST',
    headers: studentAHeaders,
    body: JSON.stringify({
      questionId: questionXId,
      answer: '4',
      timeTakenSeconds: 12,
    }),
  });
  const answerAData = await answerARes.json();
  assert.strictEqual(answerAData.isCorrect, true);
  assert.strictEqual(answerAData.earnedPoints, 10);

  // Student A submits
  const submitARes = await fetch(`${BASE_URL}/api/student/tests/${assignmentAId}/submit`, {
    method: 'POST',
    headers: studentAHeaders,
  });
  assert.strictEqual(submitARes.status, 200, 'Student A submit failed');
  const submitAData = await submitARes.json();
  assert.strictEqual(submitAData.status, 'COMPLETED');
  assert.strictEqual(submitAData.scoreOutOf100, 100);
  console.log('[SETUP] Student A successfully COMPLETED assessment with 100% score');

  // Verify Student B has NOT_STARTED test
  const studentBTestsRes = await fetch(`${BASE_URL}/api/student/tests`, { headers: studentBHeaders });
  const studentBTests = await studentBTestsRes.json();
  const assignmentB = studentBTests.find((t) => t.publishedTestId === publishedTestId);
  assert.ok(assignmentB, 'Assignment for Student B not found');
  assert.strictEqual(assignmentB.status, 'NOT_STARTED');
  const assignmentBId = assignmentB.assignmentId || assignmentB.id;

  // =============================================================
  // FIX 1 TEST CYCLE: 3 SEQUENTIAL QUESTION BANK EDITS
  // =============================================================
  console.log('\n--- TESTING FIX 1: MULTIPLE QUESTION EDITS & COMPLETED STUDENT ISOLATION ---');

  // Helper to verify Student A historical report
  async function verifyStudentAOriginalIntegrity(editStepName) {
    const repRes = await fetch(`${BASE_URL}/api/reports/students/${studentAId}`, { headers: adminHeaders });
    assert.strictEqual(repRes.status, 200, `Failed to fetch Student A report after ${editStepName}`);
    const repData = await repRes.json();
    const timelineEntry = repData.timeline?.find((t) => t.publishedTestId === publishedTestId);
    assert.ok(timelineEntry, `Timeline entry for Student A not found after ${editStepName}`);

    // Status & Score
    assert.strictEqual(timelineEntry.status, 'COMPLETED', `Student A status must remain COMPLETED after ${editStepName}`);
    assert.strictEqual(timelineEntry.scoreOutOf100, 100, `Student A score must remain 100 after ${editStepName}`);
    assert.strictEqual(timelineEntry.totalPointsEarned, 10, `Student A totalPointsEarned must remain 10 after ${editStepName}`);
    assert.strictEqual(timelineEntry.correctCount, 1, `Student A correctCount must remain 1 after ${editStepName}`);

    // Question-level log
    const qLog = timelineEntry.questions?.find((q) => (q.questionId || q.id) === questionXId);
    assert.ok(qLog, `Question X log not found in Student A report after ${editStepName}`);
    assert.strictEqual(qLog.content, `What is 2 + 2? ${uniqueSuffix}`, `Question content must remain original after ${editStepName}`);
    assert.deepStrictEqual(qLog.options, ['3', '4', '5', '6'], `Question options must remain original after ${editStepName}`);
    assert.strictEqual(qLog.correctAnswer, '4', `Correct answer must remain "4" after ${editStepName}`);
    assert.strictEqual(qLog.studentAnswer, '4', `Student answer must remain "4" after ${editStepName}`);
    assert.strictEqual(qLog.isCorrect, true, `isCorrect must remain true after ${editStepName}`);
    assert.strictEqual(qLog.points, 10, `points must remain 10 after ${editStepName}`);
    assert.strictEqual(qLog.earnedPoints, 10, `earnedPoints must remain 10 after ${editStepName}`);
    assert.strictEqual(qLog.timeSeconds, 30, `timeSeconds must remain 30 after ${editStepName}`);
    assert.strictEqual(qLog.timeTakenSeconds, 12, `timeTakenSeconds must remain 12 after ${editStepName}`);
    assert.strictEqual(qLog.difficulty, 'Easy', `difficulty must remain Easy after ${editStepName}`);
  }

  // --- EDIT #1 ---
  await test('Admin Edit #1: Change to "What is 3 + 3?", options: [5, 6, 7, 8], correct: "6", points: 20', async () => {
    const edit1Res = await fetch(`${BASE_URL}/api/questions/${questionXId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        groupId,
        difficulty: 'Medium',
        content: `What is 3 + 3? ${uniqueSuffix}`,
        points: 20,
        timeSeconds: 45,
        options: ['5', '6', '7', '8'],
        correctAnswer: '6',
        answerType: 'single',
      }),
    });
    assert.strictEqual(edit1Res.status, 200, 'Edit #1 failed');
    const q1 = await edit1Res.json();
    assert.strictEqual(q1.content, `What is 3 + 3? ${uniqueSuffix}`);
    assert.strictEqual(q1.correctAnswer, '6');
    assert.strictEqual(q1.points, 20);
    assert.strictEqual(q1.difficulty, 'Medium');
  });

  await test('Fix 1 (After Edit #1): Completed Student A data is 100% unchanged', async () => {
    await verifyStudentAOriginalIntegrity('Edit #1');
  });

  // --- EDIT #2 ---
  await test('Admin Edit #2: Change to "What is 5 + 5?", options: [10, 11, 12, 13], correct: "10", points: 30', async () => {
    const edit2Res = await fetch(`${BASE_URL}/api/questions/${questionXId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        groupId,
        difficulty: 'Hard',
        content: `What is 5 + 5? ${uniqueSuffix}`,
        points: 30,
        timeSeconds: 60,
        options: ['10', '11', '12', '13'],
        correctAnswer: '10',
        answerType: 'single',
      }),
    });
    assert.strictEqual(edit2Res.status, 200, 'Edit #2 failed');
    const q2 = await edit2Res.json();
    assert.strictEqual(q2.content, `What is 5 + 5? ${uniqueSuffix}`);
    assert.strictEqual(q2.correctAnswer, '10');
    assert.strictEqual(q2.points, 30);
    assert.strictEqual(q2.difficulty, 'Hard');
  });

  await test('Fix 1 (After Edit #2): Completed Student A data is STILL 100% unchanged', async () => {
    await verifyStudentAOriginalIntegrity('Edit #2');
  });

  // --- EDIT #3 ---
  await test('Admin Edit #3: Change to "What is 10 + 10?", options: [18, 19, 20, 21], correct: "20", points: 50, type: multiple', async () => {
    const edit3Res = await fetch(`${BASE_URL}/api/questions/${questionXId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        groupId,
        difficulty: 'Hard',
        content: `What is 10 + 10? ${uniqueSuffix}`,
        points: 50,
        timeSeconds: 90,
        options: ['18', '19', '20', '21'],
        correctAnswer: '20',
        answerType: 'multiple',
      }),
    });
    assert.strictEqual(edit3Res.status, 200, 'Edit #3 failed');
    const q3 = await edit3Res.json();
    assert.strictEqual(q3.content, `What is 10 + 10? ${uniqueSuffix}`);
    assert.strictEqual(q3.correctAnswer, '20');
    assert.strictEqual(q3.points, 50);
    assert.strictEqual(q3.answerType, 'multiple');
  });

  await test('Fix 1 (After Edit #3): Completed Student A data is STILL permanently preserved exactly as original', async () => {
    await verifyStudentAOriginalIntegrity('Edit #3');
  });

  // Verify Student B (uncompleted) gets latest question from Edit #3
  await test('Uncompleted Student B receives latest updated Question X (Edit #3 content, options, points)', async () => {
    const startBRes = await fetch(`${BASE_URL}/api/student/tests/${assignmentBId}/start`, {
      method: 'POST',
      headers: studentBHeaders,
    });
    assert.strictEqual(startBRes.status, 200, 'Student B start failed');
    const startBData = await startBRes.json();
    const qB = startBData.questions?.find((q) => (q.questionId || q.id) === questionXId);
    assert.ok(qB, 'Question X not found for Student B');
    assert.strictEqual(qB.content, `What is 10 + 10? ${uniqueSuffix}`, 'Student B must see Edit #3 question content');
    assert.deepStrictEqual(qB.options, ['18', '19', '20', '21'], 'Student B must see Edit #3 options');
    assert.strictEqual(qB.points, 50, 'Student B must see Edit #3 points: 50');
    assert.strictEqual(qB.timeAllowedSeconds, 90, 'Student B must see Edit #3 time: 90s');
    assert.strictEqual(qB.answerType, 'multiple', 'Student B must see Edit #3 answerType: multiple');
  });

  // =============================================================
  // FIX 2 TEST: QUESTION GROUP & QUESTION VIEW COMPLETE DETAILS
  // =============================================================
  console.log('\n--- TESTING FIX 2: QUESTION GROUP VIEW COMPLETE QUESTION DETAILS ---');

  await test('Fix 2: Question Model provides all complete question details for read-only Review', async () => {
    const qListRes = await fetch(`${BASE_URL}/api/questions?groupId=${groupId}`, { headers: adminHeaders });
    assert.strictEqual(qListRes.status, 200);
    const qList = await qListRes.json();
    const foundQ = qList.find((q) => q.id === questionXId);
    assert.ok(foundQ, 'Question X not found in Question Bank');

    // Confirm complete available details are present:
    // Question Text
    assert.ok(foundQ.content, 'Content must exist');
    assert.strictEqual(typeof foundQ.content, 'string');

    // Options
    assert.ok(Array.isArray(foundQ.options), 'Options must be an array');
    assert(foundQ.options.length > 0, 'Options must have choices');

    // Correct Answer
    assert.ok(foundQ.correctAnswer != null, 'Correct answer must be present');

    // Question Type
    assert.ok(foundQ.answerType, 'Question answerType must be present');
    assert(['single', 'multiple'].includes(foundQ.answerType));

    // Difficulty
    assert.ok(['Easy', 'Medium', 'Hard'].includes(foundQ.difficulty));

    // Points & Time Limit
    assert.strictEqual(typeof foundQ.points, 'number');
    assert.strictEqual(typeof foundQ.timeSeconds, 'number');

    // Question Group
    assert.ok(foundQ.groupName || foundQ.groupId, 'Question Group must be present');
  });

  await test('Fix 2: Read-Only review preserves existing Edit route functionality separately', async () => {
    // Verify PUT /api/questions/:id works exclusively for editing
    const editBackRes = await fetch(`${BASE_URL}/api/questions/${questionXId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        groupId,
        difficulty: 'Easy',
        content: `What is 2 + 2? Restored ${uniqueSuffix}`,
        points: 15,
        timeSeconds: 30,
        options: ['1', '2', '3', '4'],
        correctAnswer: '4',
        answerType: 'single',
      }),
    });
    assert.strictEqual(editBackRes.status, 200, 'Separate Edit functionality must continue working');
    const restored = await editBackRes.json();
    assert.strictEqual(restored.content, `What is 2 + 2? Restored ${uniqueSuffix}`);
    assert.strictEqual(restored.points, 15);

    // And Student A still preserves original 2+2
    await verifyStudentAOriginalIntegrity('Final Check');
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('[UNCAUGHT ERROR]:', err);
  process.exit(1);
});
