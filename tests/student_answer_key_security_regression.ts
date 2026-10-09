import assert from 'node:assert/strict';
import { serializeQuestionForRole, serializeStudentQuestion } from '../backend/services/studentQuestionSerializer.ts';

const sourceQuestion = {
  _id: 'question-1',
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
  expectedResponse: 'The expected response',
  scoringGuide: 'Give full credit for B',
  assessorNotes: 'Private assessor note',
  isCorrect: true,
  earnedPoints: 5,
  metadata: {
    scoringMode: 'manual-rubric',
    source: {
      expectedResponse: 'Nested expected response',
      scoringGuide: 'Nested grading criteria',
      assessorNotes: 'Nested note',
      correctAnswer: 'B',
    },
    pairs: [
      { left: 'L1', right: 'R1', scoringGuide: 'Private pair rubric' },
      { left: 'L2', right: 'R2', expectedResponse: 'Private pair key' },
      { left: 'L3', right: 'R3', assessorNotes: 'Private note' },
    ],
  },
  nestedSnapshot: { metadata: { answerKey: 'B', rubric: 'Private rubric' } },
};

const serializedStudentQuestion = serializeStudentQuestion(sourceQuestion);
const serializedStudentText = JSON.stringify(serializedStudentQuestion).toLowerCase();

for (const sensitiveValue of [
  'correctanswer', 'correctanswers', 'expectedresponse', 'scoringguide', 'assessornotes',
  'manual-rubric', 'answerkey', 'rubric', 'iscorrect', 'earnedpoints', 'nestedSnapshot'.toLowerCase(),
]) {
  assert.equal(serializedStudentText.includes(sensitiveValue), false, `Student question excludes ${sensitiveValue}`);
}
assert.equal(serializedStudentQuestion.content, sourceQuestion.content, 'Student still receives question text');
assert.deepEqual(serializedStudentQuestion.options, sourceQuestion.options, 'Student still receives options');
assert.equal(serializedStudentQuestion.questionId, 'question-1', 'Question identity is preserved');
assert.deepEqual(serializedStudentQuestion.pairs.map((pair: any) => pair.left), ['L1', 'L2', 'L3']);
assert.deepEqual(new Set(serializedStudentQuestion.pairs.map((pair: any) => pair.right)), new Set(['R1', 'R2', 'R3']));
assert.equal(
  serializedStudentQuestion.pairs.every((pair: any, index: number) => pair.right !== `R${index + 1}`),
  true,
  'Matching pairs preserve the student interaction while removing the source answer mapping',
);

// This is the serializer used by the student /question-groups and /questions routes.
assert.deepEqual(
  (() => {
    const { pairs: _pairs, ...allowlistedFields } = serializeQuestionForRole(sourceQuestion, 'student');
    return allowlistedFields;
  })(),
  (() => {
    const { pairs: _pairs, ...allowlistedFields } = serializedStudentQuestion;
    return allowlistedFields;
  })(),
  'Student question endpoints use the allowlisted projection',
);

// Assessor/admin routes retain the source fields through the non-student path.
const serializedAdminQuestion = serializeQuestionForRole(sourceQuestion, 'super_admin');
assert.equal(serializedAdminQuestion.correctAnswer, 'B');
assert.equal(serializedAdminQuestion.expectedResponse, sourceQuestion.expectedResponse);
assert.equal(serializedAdminQuestion.scoringGuide, sourceQuestion.scoringGuide);
assert.equal(serializedAdminQuestion.metadata.source.scoringGuide, 'Nested grading criteria');

// Start, resume, and student self-report all pass question-shaped records through this same allowlist.
for (const endpointQuestion of [
  { ...sourceQuestion, studentAnswer: 'A', timeTakenSeconds: 12 },
  { ...sourceQuestion, studentAnswer: 'A', isCorrect: false, earnedPoints: 0 },
]) {
  const safeEndpointQuestion = serializeStudentQuestion(endpointQuestion);
  const endpointText = JSON.stringify(safeEndpointQuestion).toLowerCase();
  assert.equal(endpointText.includes('correctanswer'), false);
  assert.equal(endpointText.includes('expectedresponse'), false);
  assert.equal(endpointText.includes('scoringguide'), false);
  assert.equal(endpointText.includes('assessornotes'), false);
  assert.equal(endpointText.includes('iscorrect'), false);
  assert.equal(endpointText.includes('earnedpoints'), false);
}

console.log('Student answer-key security regression checks passed.');
