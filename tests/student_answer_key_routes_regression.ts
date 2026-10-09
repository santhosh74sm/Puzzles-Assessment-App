import assert from 'node:assert/strict';
import express from 'express';

// Keep this regression isolated from configured services and MongoDB.
process.env.JWT_SECRET = 'student-route-regression-secret-32chars';
process.env.REDIS_URL = '';
process.env.REDIS_HOST = '';

const [{ default: routes }, auth, models] = await Promise.all([
  import('../backend/routes.ts'),
  import('../backend/middleware/auth.ts'),
  import('../database/models.ts'),
]);

const { QuestionGroupModel, QuestionModel, PublishedTestModel, StudentTestAssignmentModel, PublishHistoryModel, UserModel } = models;
const sourceQuestion = {
  _id: 'question-1',
  id: 'question-1',
  groupId: 'group-1',
  groupName: 'Communication',
  difficulty: 'Medium',
  questionType: 'Scenario',
  answerType: 'single',
  content: 'Choose a response to the scenario.',
  options: ['A', 'B'],
  points: 5,
  timeSeconds: 30,
  correctAnswer: 'B',
  correctAnswers: ['B'],
  expectedResponse: 'Expected response',
  scoringGuide: 'Assessor-only guide',
  assessorNotes: 'Private note',
  metadata: {
    scoringMode: 'manual-rubric', expectedResponse: 'Nested expected response', scoringGuide: 'Nested guide',
    pairs: [{ left: 'L1', right: 'R1' }, { left: 'L2', right: 'R2' }, { left: 'L3', right: 'R3' }],
  },
};
const group = { _id: 'group-1', name: 'Communication', description: 'Group' };
const publishedTest = {
  _id: 'publish-1', status: 'ACTIVE', isPaused: false, startDate: 'Today', endDate: 'Open',
  targets: [{ schoolIds: ['school-1'], classes: ['Class 1'], sections: ['A'], studentIds: [] }],
};
const studentUser = {
  _id: 'student-user', username: 'student-1', uniqueStudentId: 'student-1',
  schoolId: 'school-1', schoolName: 'School', className: 'Class 1', section: 'A',
};

const originalMethods = {
  groupFind: QuestionGroupModel.find,
  questionFind: QuestionModel.find,
  publishedFindById: PublishedTestModel.findById,
  publishedFind: PublishedTestModel.find,
  assignmentFind: StudentTestAssignmentModel.find,
  assignmentFindById: StudentTestAssignmentModel.findById,
  assignmentFindByIdAndUpdate: StudentTestAssignmentModel.findByIdAndUpdate,
  historyUpdateOne: PublishHistoryModel.updateOne,
  historyFindOne: PublishHistoryModel.findOne,
  userFindById: UserModel.findById,
  userFindOne: UserModel.findOne,
  assignmentDeleteMany: StudentTestAssignmentModel.deleteMany,
};

const asQuery = (rows: any[]) => ({
  sort: async () => rows,
  lean: async () => rows,
  then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
});

let currentAssignment: any;
let savedUpdate: any;
QuestionGroupModel.find = (() => asQuery([group])) as any;
QuestionModel.find = (() => asQuery([sourceQuestion])) as any;
PublishedTestModel.findById = (async () => publishedTest) as any;
PublishedTestModel.find = (() => asQuery([publishedTest])) as any;
StudentTestAssignmentModel.find = (() => asQuery(currentAssignment ? [currentAssignment] : [])) as any;
StudentTestAssignmentModel.findById = (async () => currentAssignment) as any;
StudentTestAssignmentModel.findByIdAndUpdate = (async (_id: any, update: any) => { savedUpdate = update; }) as any;
PublishHistoryModel.updateOne = (async () => ({})) as any;
PublishHistoryModel.findOne = (async () => null) as any;
UserModel.findOne = (() => ({ lean: async () => studentUser })) as any;
UserModel.findById = (() => ({ lean: async () => studentUser })) as any;
StudentTestAssignmentModel.deleteMany = (async () => ({})) as any;

const app = express();
app.use(express.json());
app.use('/api', routes);
const server = app.listen(0, '127.0.0.1');

function assignment(status: string) {
  return {
    _id: 'assignment-1', assignmentId: 'assignment-1', publishedTestId: 'publish-1', publishName: 'Test',
    studentId: 'student-1', studentName: 'Student', schoolId: 'school-1', schoolName: 'School',
    className: 'Class 1', section: 'A', status, questions: [{
      questionId: 'question-1', groupId: 'group-1', groupName: 'Communication', difficulty: 'Medium', content: sourceQuestion.content,
      options: sourceQuestion.options, answerType: 'single', questionType: 'Scenario', points: 5,
      correctAnswer: 'B', correctAnswers: ['B'], expectedResponse: 'Snapshot expected response',
      scoringGuide: 'Snapshot rubric', assessorNotes: 'Snapshot note',
      metadata: { ...sourceQuestion.metadata, expectedResponse: 'Nested snapshot response', scoringGuide: 'Nested snapshot guide', scoringMode: 'manual-rubric' },
      studentAnswer: null, timeAllowedSeconds: 30, timeTakenSeconds: 0,
    }],
    save: async () => undefined,
  };
}

try {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api`;
  const studentToken = auth.generateToken({ userId: '507f1f77bcf86cd799439011', username: 'student-1', studentId: 'student-1', role: 'student' });
  const adminToken = auth.generateToken({ userId: 'admin-user', username: 'admin', role: 'super_admin' });
  currentAssignment = assignment('NOT_STARTED');
  const get = (path: string, token = studentToken) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const post = (path: string, token = studentToken, body: any = {}) => fetch(`${base}${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const assertSafeQuestions = (payload: any) => {
    const serialized = JSON.stringify(payload).toLowerCase();
    for (const value of ['correctanswer', 'correctanswers', 'expectedresponse', 'scoringguide', 'assessornotes', 'manual-rubric']) {
      assert.equal(serialized.includes(value), false, `Student API excludes ${value}`);
    }
  };

  const questionsResponse = await get('/questions');
  const questions = await questionsResponse.json();
  assert.equal(questionsResponse.status, 200);
  assertSafeQuestions(questions);
  assert.equal(questions[0].content, sourceQuestion.content);
  assert.deepEqual(questions[0].options, sourceQuestion.options);
  assert.equal(questions[0].pairs.every((pair: any, index: number) => pair.right !== `R${index + 1}`), true);

  const groupsResponse = await get('/question-groups');
  const groups = await groupsResponse.json();
  assert.equal(groupsResponse.status, 200);
  assertSafeQuestions(groups);
  assert.equal(groups[0].breakdown.Medium.questions[0].content, sourceQuestion.content);

  // Assignment list exposes status/card fields only, never its embedded question snapshots.
  currentAssignment = assignment('NOT_STARTED');
  StudentTestAssignmentModel.find = (() => asQuery([currentAssignment])) as any;
  const listResponse = await get('/student/tests');
  const testList = await listResponse.json();
  assert.equal(listResponse.status, 200, JSON.stringify(testList));
  assertSafeQuestions(testList);
  assert.equal(testList[0].publishName, 'Test');
  assert.equal('questions' in testList[0], false);

  // The student question-bank endpoints expose only their currently assigned snapshot.
  const assignedBankResponse = await get('/questions');
  const assignedBank = await assignedBankResponse.json();
  assert.equal(assignedBankResponse.status, 200);
  assert.equal(assignedBank.length, 1);
  assert.equal(assignedBank[0].questionId, 'question-1');
  assertSafeQuestions(assignedBank);

  // A future assessment is not eligible for question-bank discovery.
  publishedTest.startDate = '2099-12-31';
  const futureBankResponse = await get('/questions');
  assert.deepEqual(await futureBankResponse.json(), []);
  publishedTest.startDate = 'Today';

  // No assignment means no question or group content is disclosed.
  StudentTestAssignmentModel.find = (() => asQuery([])) as any;
  const emptyBankResponse = await get('/questions');
  assert.deepEqual(await emptyBankResponse.json(), []);
  const emptyGroupsResponse = await get('/question-groups');
  assert.deepEqual(await emptyGroupsResponse.json(), []);
  StudentTestAssignmentModel.find = (() => asQuery([currentAssignment])) as any;

  // Assignment IDs belonging to another student are rejected by start/resume.
  currentAssignment = assignment('IN_PROGRESS');
  currentAssignment.studentId = 'another-student';
  const otherStudentStart = await post('/student/tests/assignment-1/start');
  assert.equal(otherStudentStart.status, 403);
  currentAssignment = assignment('NOT_STARTED');

  // Resume path exercises a stored assignment snapshot containing nested rubric data.
  currentAssignment = assignment('IN_PROGRESS');
  const resumeResponse = await post('/student/tests/assignment-1/start');
  const resumed = await resumeResponse.json();
  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.isResumed, true);
  assertSafeQuestions(resumed.questions);
  assert.equal(resumed.questions[0].studentAnswer, null);

  // Initial start path has the same response projection and keeps assignment persistence in memory.
  currentAssignment = assignment('NOT_STARTED');
  const startResponse = await post('/student/tests/assignment-1/start');
  const started = await startResponse.json();
  assert.equal(startResponse.status, 200, JSON.stringify(started));
  assertSafeQuestions(started.questions);
  assert.equal(started.status, 'IN_PROGRESS');

  // Answer save and final submission keep their existing response behavior without returning question data.
  currentAssignment = assignment('IN_PROGRESS');
  const answerResponse = await post('/student/tests/assignment-1/answer', studentToken, {
    questionId: 'question-1', answer: 'A', timeTakenSeconds: 7,
  });
  const answerResult = await answerResponse.json();
  assert.equal(answerResponse.status, 200);
  assert.equal(answerResult.success, true);
  assert.equal(savedUpdate.$set['questions.0.studentAnswer'], 'A');
  assertSafeQuestions(answerResult);

  currentAssignment = assignment('IN_PROGRESS');
  const submitResponse = await post('/student/tests/assignment-1/submit', studentToken, {
    answers: [{ questionId: 'question-1', answer: 'A', timeTakenSeconds: 7 }],
  });
  const submitResult = await submitResponse.json();
  assert.equal(submitResponse.status, 200);
  assert.equal(submitResult.status, 'COMPLETED');
  assertSafeQuestions(submitResult);

  // The authorized admin question endpoint continues returning the assessor fields.
  const adminResponse = await get('/questions', adminToken);
  const adminQuestions = await adminResponse.json();
  assert.equal(adminResponse.status, 200);
  assert.equal(adminQuestions[0].correctAnswer, 'B');
  assert.equal(adminQuestions[0].expectedResponse, sourceQuestion.expectedResponse);
  assert.equal(adminQuestions[0].scoringGuide, sourceQuestion.scoringGuide);
  const adminGroupsResponse = await get('/question-groups', adminToken);
  const adminGroups = await adminGroupsResponse.json();
  assert.equal(adminGroupsResponse.status, 200);
  assert.equal(adminGroups[0].breakdown.Medium.questions[0].correctAnswer, 'B');

  console.log('Student answer-key route regression checks passed (all database model calls were stubbed).');
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  QuestionGroupModel.find = originalMethods.groupFind;
  QuestionModel.find = originalMethods.questionFind;
  PublishedTestModel.findById = originalMethods.publishedFindById;
  PublishedTestModel.find = originalMethods.publishedFind;
  StudentTestAssignmentModel.find = originalMethods.assignmentFind;
  StudentTestAssignmentModel.findById = originalMethods.assignmentFindById;
  StudentTestAssignmentModel.findByIdAndUpdate = originalMethods.assignmentFindByIdAndUpdate;
  PublishHistoryModel.updateOne = originalMethods.historyUpdateOne;
  PublishHistoryModel.findOne = originalMethods.historyFindOne;
  UserModel.findOne = originalMethods.userFindOne;
  UserModel.findById = originalMethods.userFindById;
  StudentTestAssignmentModel.deleteMany = originalMethods.assignmentDeleteMany;
}
