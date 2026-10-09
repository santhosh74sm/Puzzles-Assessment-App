/**
 * Evaluates whether a question has a configured correct answer key
 * and can be scored by the automatic assessment scorer.
 */
export function hasAutomaticallyScorableAnswer(question: any): boolean {
  return (
    (question?.correctAnswer !== undefined &&
      question.correctAnswer !== null &&
      String(question.correctAnswer).trim() !== '') ||
    (Array.isArray(question?.correctAnswers) && question.correctAnswers.length > 0)
  );
}
