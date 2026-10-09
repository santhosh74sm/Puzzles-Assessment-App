/**
 * Questions with source rubrics must remain available for human review. Their
 * answer keys may be retained as reference data, but must not be converted to
 * binary correctness counts by the automatic assessment scorer.
 */
export function hasAutomaticallyScorableAnswer(question: any): boolean {
  if (question?.metadata?.scoringMode === 'manual-rubric') return false;
  return (
    (question?.correctAnswer !== undefined &&
      question.correctAnswer !== null &&
      String(question.correctAnswer).trim() !== '') ||
    (Array.isArray(question?.correctAnswers) && question.correctAnswers.length > 0)
  );
}
