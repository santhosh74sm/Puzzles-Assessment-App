import assert from 'node:assert/strict';
import express from 'express';

// Route-level regression with in-memory model stubs only; no configured database is used.
process.env.JWT_SECRET = 'publish-regression-secret-32chars';
process.env.REDIS_URL = '';
process.env.REDIS_HOST = '';

const [{ default: routes }, auth, models] = await Promise.all([
  import('../backend/routes.ts'),
  import('../backend/middleware/auth.ts'),
  import('../database/models.ts'),
]);
const { PublishedTestModel, StudentTestAssignmentModel, PublishHistoryModel, SchoolModel, UserModel, QuestionModel } = models;

const originals: Record<string, any> = {};
for (const [modelName, model] of Object.entries({ PublishedTestModel, StudentTestAssignmentModel, PublishHistoryModel, SchoolModel, UserModel, QuestionModel })) {
  originals[modelName] = {};
  for (const name of ['findOne', 'create', 'updateOne', 'findById', 'deleteOne', 'deleteMany', 'insertMany', 'countDocuments', 'find']) {
    if ((model as any)[name]) originals[modelName][name] = (model as any)[name];
  }
}

let nextId = 1;
let failAssignmentInsert = false;
let failHistoryCreate = false;
let failAssignmentCleanup = false;
const published = new Map<string, any>();
const assignments: any[] = [];
const histories: any[] = [];
const student = {
  _id: 'student-object-id', uniqueStudentId: 'student-1', username: 'student-1',
  studentName: 'Student One', schoolId: 'school-1', schoolName: 'School One',
  className: 'Class 1', section: 'A',
};
const school = { _id: 'school-1', name: 'School One' };
const question = {
  _id: 'question-1', id: 'question-1', groupId: 'group-1', groupName: 'Communication',
  difficulty: 'Medium', questionType: 'MCQ', answerType: 'single', content: 'A test question',
  options: ['A', 'B'], correctAnswer: 'B', correctAnswers: ['B'], points: 1, timeSeconds: 30, metadata: {},
};
const query = (rows: any[]) => ({ lean: async () => rows, then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) });
const document = (source: any) => ({ ...source, toObject: () => ({ ...source }) });

(PublishedTestModel as any).findOne = async ({ idempotencyKey, publishId }: any) => {
  if (idempotencyKey) return [...published.values()].find((p) => p.idempotencyKey === idempotencyKey) || null;
  return histories.find((h) => h.publishId === publishId) || null;
};
(PublishedTestModel as any).create = async (data: any) => {
  if ([...published.values()].some((p) => p.idempotencyKey === data.idempotencyKey)) throw Object.assign(new Error('duplicate'), { code: 11000 });
  const doc: any = document({ ...data, _id: `publish-${nextId++}` });
  published.set(doc._id, doc);
  return doc;
};
(PublishedTestModel as any).updateOne = async ({ _id }: any, { $set }: any) => {
  const item = published.get(String(_id));
  if (!item) return { matchedCount: 0 };
  Object.assign(item, $set);
  return { matchedCount: 1, modifiedCount: 1 };
};
(PublishedTestModel as any).findById = async (id: any) => published.get(String(id)) || null;
(PublishedTestModel as any).deleteOne = async ({ _id }: any) => ({ deletedCount: published.delete(String(_id)) ? 1 : 0 });
(StudentTestAssignmentModel as any).insertMany = async (rows: any[]) => {
  if (failAssignmentInsert) { failAssignmentInsert = false; throw new Error('injected assignment insert failure'); }
  assignments.push(...rows);
  return rows;
};
(StudentTestAssignmentModel as any).deleteMany = async ({ publishedTestId }: any) => {
  if (failAssignmentCleanup) { failAssignmentCleanup = false; throw new Error('injected cleanup failure'); }
  const before = assignments.length;
  for (let i = assignments.length - 1; i >= 0; i--) if (assignments[i].publishedTestId === publishedTestId) assignments.splice(i, 1);
  return { deletedCount: before - assignments.length };
};
(StudentTestAssignmentModel as any).countDocuments = async ({ publishedTestId }: any) => assignments.filter((a) => a.publishedTestId === publishedTestId).length;
(PublishHistoryModel as any).create = async (data: any) => {
  if (failHistoryCreate) { failHistoryCreate = false; throw new Error('injected publish history failure'); }
  const doc = document({ ...data, _id: `history-${nextId++}` }); histories.push(doc); return doc;
};
(PublishHistoryModel as any).findOne = async ({ publishId }: any) => histories.find((h) => h.publishId === publishId) || null;
(PublishHistoryModel as any).deleteOne = async ({ publishId }: any) => {
  const at = histories.findIndex((h) => h.publishId === publishId);
  if (at < 0) return { deletedCount: 0 };
  histories.splice(at, 1); return { deletedCount: 1 };
};
(SchoolModel as any).find = async ({ _id }: any) => _id?.$in?.includes('school-1') ? [school] : [];
(UserModel as any).find = () => query([student]);
(QuestionModel as any).find = async () => [question];

const app = express();
app.use(express.json());
app.use('/api', routes);
const server = app.listen(0, '127.0.0.1');
try {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/publish`;
  const token = auth.generateToken({ userId: 'admin-1', username: 'admin', role: 'super_admin' });
  const payload: any = {
    publishName: 'Regression Assessment', publishMode: 'Selected Questions',
    targets: [{ schoolIds: ['school-1'], classes: ['Class 1'], sections: ['A'], studentIds: [] }],
    target: { schoolId: 'school-1', schoolIds: ['school-1'], classes: ['Class 1'], sections: ['A'], studentIds: [] },
    startDate: 'Today', startTime: '12:00 AM', endDate: 'Open', endTime: '11:59 PM',
    selectedQuestionIds: ['question-1'], randomCount: 1, shuffle: false,
  };
  const send = (key: string, data = payload) => fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(data),
  });

  const normal = await send('normal-request');
  assert.equal(normal.status, 201);
  const normalData = await normal.json();
  assert.equal(assignments.length, 1);
  assert.equal(histories.length, 1);

  const retry = await send('normal-request');
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).idempotentReplay, true);
  assert.equal(published.size, 1);
  assert.equal(assignments.length, 1);
  assert.equal(histories.length, 1);

  const changedUnderSameKey = await send('normal-request', { ...payload, publishName: 'Changed request' });
  assert.equal(changedUnderSameKey.status, 409);

  // Same settings with a new request identity remain a legitimate new publication.
  const intentionalNew = await send('intentional-new-request');
  assert.equal(intentionalNew.status, 201);
  assert.equal(published.size, 2);
  assert.notEqual((await intentionalNew.json()).publishedTest.id, normalData.publishedTest.id);

  // Concurrent duplicate requests must converge on one published record at most.
  const concurrentBefore = published.size;
  const concurrent = await Promise.all([send('concurrent-request'), send('concurrent-request')]);
  assert.ok(concurrent.every((r) => [200, 201, 409].includes(r.status)));
  assert.equal(published.size, concurrentBefore + 1);
  assert.equal(assignments.filter((a) => a.publishedTestId === [...published.values()].find((p) => p.idempotencyKey === 'concurrent-request')?._id).length, 1);

  // Inject an intermediate write failure and verify compensating cleanup.
  const beforeFailedPublish = { published: published.size, assignments: assignments.length, histories: histories.length };
  failAssignmentInsert = true;
  const failed = await send('failure-request');
  assert.equal(failed.status, 500);
  assert.equal(published.size, beforeFailedPublish.published);
  assert.equal(assignments.length, beforeFailedPublish.assignments);
  assert.equal(histories.length, beforeFailedPublish.histories);

  // A history failure occurs after assignment insertion; successful cleanup removes those assignments.
  failHistoryCreate = true;
  const failedHistory = await send('history-failure-request');
  assert.equal(failedHistory.status, 500);
  assert.equal(published.size, beforeFailedPublish.published);
  assert.equal(assignments.length, beforeFailedPublish.assignments);
  assert.equal(histories.length, beforeFailedPublish.histories);

  // If cleanup itself fails, a FAILED marker lets the next same-key retry clean its own records and recover.
  failHistoryCreate = true;
  failAssignmentCleanup = true;
  const partialFailure = await send('recoverable-failure-request');
  assert.equal(partialFailure.status, 500);
  assert.equal([...published.values()].some((p) => p.idempotencyKey === 'recoverable-failure-request' && p.publishState === 'FAILED'), true);

  const recoveredRetry = await send('recoverable-failure-request');
  assert.equal(recoveredRetry.status, 201);
  assert.equal(published.size, beforeFailedPublish.published + 1);
  assert.equal(assignments.length, beforeFailedPublish.assignments + 1);
  assert.equal(histories.length, beforeFailedPublish.histories + 1);

  // Existing target validation still rejects a missing target school before creating records.
  const badTargetPayload = { ...payload, targets: [{ schoolIds: ['missing-school'], classes: [], sections: [], studentIds: [] }], target: { schoolIds: ['missing-school'] } };
  const invalidTarget = await send('invalid-target-request', badTargetPayload);
  assert.equal(invalidTarget.status, 404);
  assert.equal(published.size, beforeFailedPublish.published + 1);

  console.log('Publish idempotency regression checks passed (all model operations were stubbed; no database writes occurred).');
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  for (const [modelName, model] of Object.entries({ PublishedTestModel, StudentTestAssignmentModel, PublishHistoryModel, SchoolModel, UserModel, QuestionModel })) {
    for (const [name, method] of Object.entries(originals[modelName])) (model as any)[name] = method;
  }
}
