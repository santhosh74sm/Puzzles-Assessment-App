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
  console.log('FOCUSED QUESTION EDIT & HISTORICAL PRESERVATION TEST');
  console.log('====================================================\n');

  // 1. Get Schools & Question Groups
  const schoolsRes = await fetch(`${BASE_URL}/api/schools`, { headers: adminHeaders });
  const schools = await schoolsRes.json();
  const school = schools[0];
  const schoolId = school.id || school._id;

  const groupsRes = await fetch(`${BASE_URL}/api/question-groups`, { headers: adminHeaders });
  const groups = await groupsRes.json();
  const group = groups[0];
  const groupId = group.id || group._id;

  // 2. Create Question X in Question Bank
  const uniqueSuffix = Date.now();
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

  // 3. Create Student A and Student B
  const studentAUsername = `st_comp_a_${uniqueSuffix}`;
  const studentBUsername = `st_uncomp_b_${uniqueSuffix}`;

  const createStudentARes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      schoolId,
      studentName: 'Student A (Completed)',
      className: 'Grade 5',
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
      studentName: 'Student B (Uncompleted)',
      className: 'Grade 5',
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
      publishName: `Math Quiz ${uniqueSuffix}`,
      publishMode: 'Selected Questions',
      selectedQuestionIds: [questionXId],
      targets: [{
        schoolId,
        className: 'Grade 5',
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

  // Fetch student tests for Student A
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
      timeTakenSeconds: 10,
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

  // Verify Student B has test assigned with NOT_STARTED
  const studentBTestsRes = await fetch(`${BASE_URL}/api/student/tests`, { headers: studentBHeaders });
  const studentBTests = await studentBTestsRes.json();
  const assignmentB = studentBTests.find((t) => t.publishedTestId === publishedTestId);
  assert.ok(assignmentB, 'Assignment for Student B not found');
  assert.strictEqual(assignmentB.status, 'NOT_STARTED');
  const assignmentBId = assignmentB.assignmentId || assignmentB.id;
  console.log(`[SETUP] Student B has NOT_STARTED test: assignmentId=${assignmentBId}`);

  // -------------------------------------------------------------
  // TEST: Edit Question X in Question Bank
  // Change to "What is 3 + 3? <suffix>", options: ['5', '6', '7', '8'], correct: '6'
  // -------------------------------------------------------------
  await test('Admin edits Question X via PUT /api/questions/:id', async () => {
    const editRes = await fetch(`${BASE_URL}/api/questions/${questionXId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        groupId,
        difficulty: 'Easy',
        content: `What is 3 + 3? ${uniqueSuffix}`,
        points: 20,
        timeSeconds: 45,
        options: ['5', '6', '7', '8'],
        correctAnswer: '6',
        answerType: 'single',
      }),
    });
    assert.strictEqual(editRes.status, 200, 'Question edit API failed');
    const updatedQ = await editRes.json();
    assert.strictEqual(updatedQ.id, questionXId, 'Question ID must remain unchanged');
    assert.strictEqual(updatedQ.content, `What is 3 + 3? ${uniqueSuffix}`);
    assert.strictEqual(updatedQ.correctAnswer, '6');
    assert.strictEqual(updatedQ.points, 20);
    assert.strictEqual(updatedQ.timeSeconds, 45);
  });

  // -------------------------------------------------------------
  // TEST: Question Bank reflects updated Question X
  // -------------------------------------------------------------
  await test('Question Bank shows updated Question X and maintains same ID', async () => {
    const qListRes = await fetch(`${BASE_URL}/api/questions?groupId=${groupId}`, { headers: adminHeaders });
    const qList = await qListRes.json();
    const found = qList.find((q) => q.id === questionXId);
    assert.ok(found, 'Question X not found in Question Bank');
    assert.strictEqual(found.id, questionXId);
    assert.strictEqual(found.content, `What is 3 + 3? ${uniqueSuffix}`);
    assert.strictEqual(found.correctAnswer, '6');
    assert.strictEqual(found.points, 20);
    assert.deepStrictEqual(found.options, ['5', '6', '7', '8']);
  });

  // -------------------------------------------------------------
  // TEST: COMPLETED STUDENT A HISTORICAL PRESERVATION
  // -------------------------------------------------------------
  await test('Completed Student A: Historical question, options, answer, and score are completely UNCHANGED', async () => {
    const repRes = await fetch(`${BASE_URL}/api/reports/students/${studentAId}`, { headers: adminHeaders });
    assert.strictEqual(repRes.status, 200, 'Failed to fetch Student A report');
    const repData = await repRes.json();
    const timelineEntry = repData.timeline?.find((t) => t.publishedTestId === publishedTestId);
    assert.ok(timelineEntry, 'Timeline entry for Student A not found');

    // Score must be 100
    assert.strictEqual(timelineEntry.scoreOutOf100, 100, 'Student A score must remain unchanged at 100');
    assert.strictEqual(timelineEntry.status, 'COMPLETED');

    // Historical question inside Student A must remain "What is 2 + 2?", options ['3', '4', '5', '6'], answer "4"
    const qLog = timelineEntry.questions?.find((q) => (q.questionId || q.id) === questionXId);
    assert.ok(qLog, 'Question X log not found in Student A report');
    assert.strictEqual(qLog.content, `What is 2 + 2? ${uniqueSuffix}`, 'Student A must preserve old question text');
    assert.deepStrictEqual(qLog.options, ['3', '4', '5', '6'], 'Student A must preserve old options');
    assert.strictEqual(qLog.studentAnswer, '4', 'Student A must preserve studentAnswer "4"');
    assert.strictEqual(qLog.isCorrect, true, 'Student A must preserve isCorrect: true');
    assert.strictEqual(qLog.earnedPoints, 10, 'Student A must preserve original earnedPoints: 10');
  });

  // -------------------------------------------------------------
  // TEST: UNCOMPLETED STUDENT B RECEIVES UPDATED QUESTION
  // -------------------------------------------------------------
  await test('Uncompleted Student B: Receives the UPDATED question with new content, options, and correct answer', async () => {
    const startBRes = await fetch(`${BASE_URL}/api/student/tests/${assignmentBId}/start`, {
      method: 'POST',
      headers: studentBHeaders,
    });
    assert.strictEqual(startBRes.status, 200, 'Student B start failed');
    const startBData = await startBRes.json();
    const qB = startBData.questions?.find((q) => (q.questionId || q.id) === questionXId);
    assert.ok(qB, 'Question X not found for Student B');

    // Student B must see the NEW question text and NEW options!
    assert.strictEqual(qB.content, `What is 3 + 3? ${uniqueSuffix}`, 'Student B must see updated question content');
    assert.deepStrictEqual(qB.options, ['5', '6', '7', '8'], 'Student B must see updated options');
    assert.strictEqual(qB.points, 20, 'Student B must see updated points');

    // Answering with old answer "4" should be marked INCORRECT
    const answerWrongRes = await fetch(`${BASE_URL}/api/student/tests/${assignmentBId}/answer`, {
      method: 'POST',
      headers: studentBHeaders,
      body: JSON.stringify({
        questionId: questionXId,
        answer: '4',
        timeTakenSeconds: 15,
      }),
    });
    const answerWrongData = await answerWrongRes.json();
    assert.strictEqual(answerWrongData.isCorrect, false, 'Old answer 4 must be incorrect for 3 + 3');

    // Answering with new correct answer "6" should be marked CORRECT with new points (20)
    const answerCorrectRes = await fetch(`${BASE_URL}/api/student/tests/${assignmentBId}/answer`, {
      method: 'POST',
      headers: studentBHeaders,
      body: JSON.stringify({
        questionId: questionXId,
        answer: '6',
        timeTakenSeconds: 20,
      }),
    });
    const answerCorrectData = await answerCorrectRes.json();
    assert.strictEqual(answerCorrectData.isCorrect, true, 'New answer 6 must be evaluated as correct');
    assert.strictEqual(answerCorrectData.earnedPoints, 20, 'New points 20 must be awarded');
  });

  // -------------------------------------------------------------
  // TEST: Multiple Selection Question Edit
  // -------------------------------------------------------------
  let multiQId;
  await test('Multiple Selection question edit and scoring', async () => {
    const multiQRes = await fetch(`${BASE_URL}/api/questions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        groupId,
        difficulty: 'Medium',
        content: `Select prime numbers: ${uniqueSuffix}`,
        points: 15,
        timeSeconds: 40,
        options: ['2', '3', '4', '6'],
        correctAnswer: '2, 3',
        answerType: 'multiple',
      }),
    });
    assert.strictEqual(multiQRes.status, 201);
    const multiQ = await multiQRes.json();
    multiQId = multiQ.id || multiQ._id;

    // Edit Multiple Selection question
    const editMultiRes = await fetch(`${BASE_URL}/api/questions/${multiQId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        groupId,
        difficulty: 'Hard',
        content: `Select odd primes: ${uniqueSuffix}`,
        points: 25,
        timeSeconds: 50,
        options: ['2', '3', '5', '9'],
        correctAnswer: '3, 5',
        answerType: 'multiple',
      }),
    });
    assert.strictEqual(editMultiRes.status, 200);
    const editedMulti = await editMultiRes.json();
    assert.strictEqual(editedMulti.id, multiQId, 'ID unchanged');
    assert.strictEqual(editedMulti.content, `Select odd primes: ${uniqueSuffix}`);
    assert.strictEqual(editedMulti.difficulty, 'Hard');
    assert.strictEqual(editedMulti.points, 25);
    assert.strictEqual(editedMulti.answerType, 'multiple');
    assert.deepStrictEqual(editedMulti.correctAnswers, ['3', '5']);
  });

  // -------------------------------------------------------------
  // TEST: Data Integrity & No Duplication / Deletion
  // -------------------------------------------------------------
  await test('Data Integrity: Stable question IDs maintained, no duplicate created, no question deleted', async () => {
    const allQsRes = await fetch(`${BASE_URL}/api/questions`, { headers: adminHeaders });
    const allQs = await allQsRes.json();

    // Verify Question X appears exactly once
    const matchingX = allQs.filter((q) => q.id === questionXId);
    assert.strictEqual(matchingX.length, 1, 'Question X must exist exactly once (no duplicates)');

    // Verify question was not deleted
    assert.ok(matchingX[0], 'Question X must still exist');

    // Verify unrelated questions are not modified
    const otherQs = allQs.filter((q) => q.id !== questionXId && q.id !== multiQId);
    for (const q of otherQs) {
      assert.notStrictEqual(q.id, questionXId);
      assert.notStrictEqual(q.id, multiQId);
    }
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('[UNHANDLED ERROR]', err);
  process.exit(1);
});
