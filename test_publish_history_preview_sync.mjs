import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'puzzles_app_jwt_2026_9fK8xQ2mL7vR4tY9';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3000');
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`[PASS] ${message}`);
}

async function run() {
  console.log('====================================================');
  console.log('TEST: QUESTION & GROUP SYNCHRONIZATION WITH PUBLISH HISTORY PREVIEW');
  console.log('====================================================');

  const token = makeToken({
    userId: '6ab4f7675d81e465df7ed5f6',
    username: 'superadmin_audit',
    role: 'super_admin',
  });

  // 2. Create Question Group
  const groupRes = await makeRequest(
    'POST',
    '/api/question-groups',
    {
      name: `Sync Group ${Date.now()}`,
      description: 'Test Group for Synchronization',
    },
    token
  );
  assert(groupRes.status === 201 && groupRes.data.id, 'Created Question Group');
  const groupId = groupRes.data.id;
  const initialGroupName = groupRes.data.name;

  // 3. Create Question X
  const qRes = await makeRequest(
    'POST',
    '/api/questions',
    {
      groupId,
      difficulty: 'Medium',
      content: 'Original Question: What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      answerType: 'single',
      correctAnswer: '4',
      timeSeconds: 30,
      points: 10,
    },
    token
  );
  assert(qRes.status === 201 && qRes.data.id, 'Created Question X');
  const qId = qRes.data.id;

  // 4. Create a second Question Y in the same group (to test group delete & single question delete independently)
  const qRes2 = await makeRequest(
    'POST',
    '/api/questions',
    {
      groupId,
      difficulty: 'Easy',
      content: 'Question Y: What is the capital of France?',
      options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
      answerType: 'single',
      correctAnswer: 'Paris',
      timeSeconds: 45,
      points: 5,
    },
    token
  );
  assert(qRes2.status === 201 && qRes2.data.id, 'Created Question Y');
  const qId2 = qRes2.data.id;

  // 5. Get a student to test completed student immutability
  const studentsRes = await makeRequest('GET', '/api/students', null, token);
  assert(studentsRes.status === 200 && studentsRes.data.length > 0, 'Fetched students list');
  const testStudent = studentsRes.data[0];

  // 6. Publish Assessment containing Question X & Question Y
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const publishRes = await makeRequest(
    'POST',
    '/api/publish',
    {
      publishName: `Sync Audit Test ${Date.now()}`,
      publishMode: 'Selected Questions',
      selectedQuestionIds: [qId, qId2],
      shuffle: false,
      targets: [
        {
          schoolId: testStudent.schoolId,
          className: testStudent.className || 'Grade 5',
          sections: [testStudent.section || 'A'],
        },
      ],
      startDate: todayStr,
      startTime: '12:00 AM',
      endDate: 'Open',
      endTime: '11:59 PM',
    },
    token
  );
  if (publishRes.status !== 201) {
    console.error('Publish error:', publishRes.data || publishRes.text);
  }
  assert(publishRes.status === 201 && (publishRes.data.publishedTest?.id || publishRes.data.publishedTestId), 'Published Assessment with Question X and Question Y');
  const publishId = publishRes.data.publishedTest?.id || publishRes.data.publishedTest?._id || publishRes.data.publishedTestId;

  // 7. Student logs in and COMPLETS the assessment with original Question X
  const sToken = makeToken({
    userId: testStudent.id || testStudent._id,
    username: testStudent.uniqueStudentId,
    role: 'student',
    schoolId: testStudent.schoolId,
  });

  const stuTests = await makeRequest('GET', '/api/student/tests', null, sToken);
  const myAssign = stuTests.data.find((t) => t.publishedTestId === publishId);
  assert(myAssign && myAssign.id, 'Found student assignment');
  const assignmentId = myAssign.id;

  // Start test
  const startRes = await makeRequest('POST', `/api/student/tests/${assignmentId}/start`, null, sToken);
  assert(startRes.status === 200, 'Student started test');

  // Submit Answer for Question X (Answer: '4')
  const ansRes = await makeRequest(
    'POST',
    `/api/student/tests/${assignmentId}/answer`,
    {
      questionId: qId,
      answer: '4',
      timeTakenSeconds: 5,
    },
    sToken
  );
  assert(ansRes.status === 200, 'Student answered Question X with 4');

  // Submit Answer for Question Y (Answer: 'Paris')
  const ansRes2 = await makeRequest(
    'POST',
    `/api/student/tests/${assignmentId}/answer`,
    {
      questionId: qId2,
      answer: 'Paris',
      timeTakenSeconds: 5,
    },
    sToken
  );
  assert(ansRes2.status === 200, 'Student answered Question Y with Paris');

  // Complete and submit test
  const submitRes = await makeRequest('POST', `/api/student/tests/${assignmentId}/submit`, null, sToken);
  assert(submitRes.status === 200, 'Student completed and submitted test');

  // Fetch completed student report before any edits
  const studentReportBefore = await makeRequest(
    'GET',
    `/api/reports/students/${testStudent.uniqueStudentId}`,
    null,
    token
  );
  assert(studentReportBefore.status === 200, 'Fetched student reports before edits');
  const studentTimelineBefore = studentReportBefore.data.timeline || studentReportBefore.data;
  const studentAttemptBefore = studentTimelineBefore.find((a) => a.publishedTestId === publishId);
  assert(studentAttemptBefore && studentAttemptBefore.status === 'COMPLETED', 'Found completed attempt in report');
  const qXInCompletedBefore = studentAttemptBefore.questions.find((q) => String(q.questionId) === qId);
  assert(qXInCompletedBefore.content === 'Original Question: What is 2 + 2?', 'Historical Question X content is original');
  assert(qXInCompletedBefore.correctAnswer === '4', 'Historical Question X correct answer is 4');
  assert(qXInCompletedBefore.points === 10, 'Historical Question X points is 10');

  // 8. TEST REQUIREMENT 1: QUESTION UPDATE & PUBLISH HISTORY PREVIEW
  console.log('\n--- TESTING QUESTION UPDATE REFLECTION IN PUBLISH HISTORY PREVIEW ---');
  // Edit #1
  const edit1Res = await makeRequest(
    'PUT',
    `/api/questions/${qId}`,
    {
      groupId,
      difficulty: 'Hard',
      content: 'Edit #1: What is 3 + 3?',
      options: ['4', '5', '6', '7'],
      answerType: 'single',
      correctAnswer: '6',
      timeSeconds: 50,
      points: 20,
    },
    token
  );
  assert(edit1Res.status === 200, 'Question X edited to Edit #1');

  // Verify Publish History Preview shows Edit #1
  let pubHistDetail = await makeRequest('GET', `/api/publish-history/${publishId}`, null, token);
  assert(pubHistDetail.status === 200, 'Fetched Publish History Detail');
  let qXInPreview = pubHistDetail.data.questions.find((q) => String(q.questionId) === qId);
  assert(qXInPreview, 'Question X exists in Publish History Preview');
  assert(qXInPreview.content === 'Edit #1: What is 3 + 3?', 'Preview shows updated Question Text: Edit #1');
  assert(qXInPreview.difficulty === 'Hard', 'Preview shows updated Difficulty: Hard');
  assert(qXInPreview.points === 20, 'Preview shows updated Points: 20');
  assert(qXInPreview.timeSeconds === 50, 'Preview shows updated Time Limit: 50');
  assert(qXInPreview.correctAnswer === '6', 'Preview shows updated Correct Answer: 6');
  assert(qXInPreview.isQuestionDeleted === false, 'Question X is not marked deleted');

  // Edit #2: Multiple Selection
  const edit2Res = await makeRequest(
    'PUT',
    `/api/questions/${qId}`,
    {
      groupId,
      difficulty: 'Easy',
      content: 'Edit #2: Select prime numbers',
      options: ['2', '3', '4', '6'],
      answerType: 'multiple',
      correctAnswers: ['2', '3'],
      timeSeconds: 40,
      points: 15,
    },
    token
  );
  assert(edit2Res.status === 200, 'Question X edited to Edit #2 (Multiple Selection)');

  // Verify Publish History Preview shows Edit #2
  pubHistDetail = await makeRequest('GET', `/api/publish-history/${publishId}`, null, token);
  qXInPreview = pubHistDetail.data.questions.find((q) => String(q.questionId) === qId);
  assert(qXInPreview.content === 'Edit #2: Select prime numbers', 'Preview shows updated Question Text: Edit #2');
  assert(qXInPreview.questionType === 'Multiple Selection', 'Preview shows updated Question Type: Multiple Selection');
  assert(qXInPreview.points === 15, 'Preview shows updated Points: 15');
  assert(qXInPreview.correctAnswers.includes('2') && qXInPreview.correctAnswers.includes('3'), 'Preview shows updated Correct Answers');

  // 9. TEST REQUIREMENT 2: COMPLETED STUDENT HISTORICAL DATA MUST NEVER CHANGE
  console.log('\n--- TESTING COMPLETED STUDENT IMMUTABILITY AFTER MULTIPLE QUESTION EDITS ---');
  let studentReportAfterEdits = await makeRequest(
    'GET',
    `/api/reports/students/${testStudent.uniqueStudentId}`,
    null,
    token
  );
  let studentAttemptAfter = (studentReportAfterEdits.data.timeline || studentReportAfterEdits.data).find((a) => a.publishedTestId === publishId);
  let qXInCompletedAfter = studentAttemptAfter.questions.find((q) => String(q.questionId) === qId);
  assert(qXInCompletedAfter.content === 'Original Question: What is 2 + 2?', 'Completed Student STILL sees original question text: What is 2 + 2?');
  assert(qXInCompletedAfter.options.includes('4'), 'Completed Student STILL sees original options');
  assert(qXInCompletedAfter.correctAnswer === '4', 'Completed Student STILL sees original correctAnswer: 4');
  assert(qXInCompletedAfter.points === 10, 'Completed Student STILL sees original points: 10');
  assert(qXInCompletedAfter.questionType === 'Single Selection', 'Completed Student STILL sees Single Selection');
  assert(studentAttemptAfter.scoreOutOf100 === 100, 'Completed Student score is completely unchanged');

  // 10. TEST REQUIREMENT 5: GROUP RENAME
  console.log('\n--- TESTING GROUP RENAME SYNCHRONIZATION ---');
  const newGroupName = `Renamed Group ${Date.now()}`;
  const renameRes = await makeRequest(
    'PUT',
    `/api/question-groups/${groupId}`,
    {
      name: newGroupName,
    },
    token
  );
  assert(renameRes.status === 200, 'Group renamed successfully');

  // Verify Publish History Preview reflects renamed group
  pubHistDetail = await makeRequest('GET', `/api/publish-history/${publishId}`, null, token);
  qXInPreview = pubHistDetail.data.questions.find((q) => String(q.questionId) === qId);
  assert(qXInPreview.groupName === newGroupName, 'Question in Publish History reflects updated group name');
  const groupInSummary = pubHistDetail.data.questionSummary.find((g) => g.groupName === newGroupName);
  assert(groupInSummary, 'Publish History summary breakdown reflects updated group name');

  // 11. TEST REQUIREMENT 3: QUESTION DELETE
  console.log('\n--- TESTING QUESTION DELETE & PREVIEW PRESERVATION ---');
  const deleteQRes = await makeRequest('DELETE', `/api/questions/${qId}`, null, token);
  assert(deleteQRes.status === 200, 'Deleted Question X from Question Bank');

  // Verify Question Bank no longer has Question X
  const qBankCheck = await makeRequest('GET', '/api/questions', null, token);
  const qXInBank = qBankCheck.data.find((q) => q.id === qId);
  assert(!qXInBank, 'Question X is no longer in live Question Bank');

  // Verify Publish History Preview STILL CONTAINS Question X and has isQuestionDeleted = true
  pubHistDetail = await makeRequest('GET', `/api/publish-history/${publishId}`, null, token);
  qXInPreview = pubHistDetail.data.questions.find((q) => String(q.questionId) === qId);
  assert(qXInPreview != null, 'Deleted Question X is RETAINED in Publish History Preview');
  assert(qXInPreview.isQuestionDeleted === true, 'Deleted Question X is clearly marked isQuestionDeleted = true');
  assert(qXInPreview.content.length > 0, 'Deleted Question X historical content is preserved and viewable');

  // Verify Completed student data STILL unchanged after question deletion
  let studentReportAfterDel = await makeRequest(
    'GET',
    `/api/reports/students/${testStudent.uniqueStudentId}`,
    null,
    token
  );
  let studentAttemptAfterDel = (studentReportAfterDel.data.timeline || studentReportAfterDel.data).find((a) => a.publishedTestId === publishId);
  let qXInCompletedAfterDel = studentAttemptAfterDel.questions.find((q) => String(q.questionId) === qId);
  assert(qXInCompletedAfterDel.content === 'Original Question: What is 2 + 2?', 'Completed Student STILL has original question after deletion');

  // 12. TEST REQUIREMENT 4: GROUP DELETE
  console.log('\n--- TESTING GROUP DELETE & PREVIEW PRESERVATION ---');
  const deleteGroupRes = await makeRequest('DELETE', `/api/question-groups/${groupId}`, null, token);
  assert(deleteGroupRes.status === 200, 'Deleted Question Group from Question Bank');

  // Verify Publish History Preview STILL CONTAINS the questions from the deleted group and marks isGroupDeleted = true
  pubHistDetail = await makeRequest('GET', `/api/publish-history/${publishId}`, null, token);
  assert(pubHistDetail.data.questions.length >= 2, 'Publish History Preview still retains all questions from deleted group');
  const questionsInDeletedGroup = pubHistDetail.data.questions.filter((q) => String(q.groupId) === groupId || q.groupName === newGroupName);
  assert(questionsInDeletedGroup.length > 0, 'Historical group questions are viewable');
  assert(questionsInDeletedGroup.every((q) => q.isGroupDeleted === true), 'All questions in deleted group have isGroupDeleted = true');

  const deletedGroupInSummary = pubHistDetail.data.questionSummary.find((g) => g.groupName === newGroupName);
  assert(deletedGroupInSummary && deletedGroupInSummary.isGroupDeleted === true, 'Publish History summary marks group as isGroupDeleted = true');

  // Verify Completed student STILL completely unchanged after group deletion
  let studentReportAfterGroupDel = await makeRequest(
    'GET',
    `/api/reports/students/${testStudent.uniqueStudentId}`,
    null,
    token
  );
  let studentAttemptAfterGroupDel = (studentReportAfterGroupDel.data.timeline || studentReportAfterGroupDel.data).find((a) => a.publishedTestId === publishId);
  let qXAfterGroupDel = studentAttemptAfterGroupDel.questions.find((q) => String(q.questionId) === qId);
  assert(qXAfterGroupDel.content === 'Original Question: What is 2 + 2?', 'Completed Student STILL has original question after group deletion');
  assert(studentAttemptAfterGroupDel.scoreOutOf100 === 100, 'Completed Student score remains 100%');

  console.log('\n====================================================');
  console.log('ALL SYNCHRONIZATION AND IMMUTABILITY TESTS PASSED!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
