import assert from 'node:assert/strict';
import { hasAutomaticallyScorableAnswer } from '../backend/services/questionScoring.ts';

assert.equal(hasAutomaticallyScorableAnswer({ correctAnswer: 'B' }), true);
assert.equal(hasAutomaticallyScorableAnswer({ correctAnswer: null, correctAnswers: [] }), false);
assert.equal(
  hasAutomaticallyScorableAnswer({
    correctAnswer: 'C',
    correctAnswers: ['C'],
    metadata: { scoringMode: 'manual-rubric', source: { scoringGuide: '5=C; 3=partial' } },
  }),
  false,
  'Rubric-based questions retain their reference key without automatic binary scoring',
);
assert.equal(
  hasAutomaticallyScorableAnswer({
    correctAnswer: null,
    correctAnswers: [],
    metadata: { scoringMode: 'manual-rubric', source: { expectedResponse: 'No single correct answer' } },
  }),
  false,
  'Questions without a single correct answer remain non-evaluative',
);

console.log('Question scoring regression checks passed.');
