import { randomInt } from 'node:crypto';

/**
 * Student payloads are intentionally allowlisted. Question metadata is a mixed
 * source field and must never be spread into a student response.
 */
export function serializeStudentQuestion(question: any): Record<string, any> {
  const source = question?.toObject ? question.toObject({ transform: true }) : question || {};
  const questionId = source.questionId || source.id || source._id;
  const safe: Record<string, any> = {};

  const allowedFields = [
    'groupId',
    'groupName',
    'difficulty',
    'questionType',
    'answerType',
    'content',
    'timeSeconds',
    'timeAllowedSeconds',
    'points',
    'options',
    'studentAnswer',
    'writtenExplanation',
    'timeTakenSeconds',
    'rankingQuestion',
  ];

  if (questionId != null) {
    safe.questionId = String(questionId);
    safe.id = String(questionId);
  }

  for (const field of allowedFields) {
    if (source[field] !== undefined) safe[field] = source[field];
  }

  // Always supply a boolean for enableWrittenExplanation and rankingQuestion
  safe.enableWrittenExplanation = Boolean(source.enableWrittenExplanation);
  safe.rankingQuestion = Boolean(source.rankingQuestion);

  const pairs = source.pairs ?? source.metadata?.pairs;
  if (Array.isArray(pairs) && pairs.length >= 2 && pairs.every((pair) =>
    pair && typeof pair.left === 'string' && typeof pair.right === 'string'
  )) {
    // Keep the existing matching UI, but break the source left/right mapping.
    // A non-zero cyclic offset is a derangement, so the original key is never sent.
    const offset = randomInt(1, pairs.length);
    safe.pairs = pairs.map((pair, index) => ({
      left: pair.left,
      right: pairs[(index + offset) % pairs.length].right,
    }));
  }

  return safe;
}

/** Keep the existing full assessor/admin representation; restrict only student callers. */
export function serializeQuestionForRole(question: any, role?: string): any {
  if (role === 'student') return serializeStudentQuestion(question);
  return question?.toObject ? question.toObject({ transform: true }) : question;
}


