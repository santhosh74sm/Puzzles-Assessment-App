import type { Question, StudentTestAssignment, QuestionDifficulty } from '../types.ts';

export interface StudentHistoryInsight {
  totalCompletedTests: number;
  easyAccuracy: number; // 0.0 to 1.0
  mediumAccuracy: number; // 0.0 to 1.0
  hardAccuracy: number; // 0.0 to 1.0
  recentlyUsedQuestionIds: Set<string>;
}

export function computeStudentInsights(
  studentId: string,
  allAssignments: StudentTestAssignment[],
  repetitionWindowDays = 21 // Eligible after suitable gap (e.g., 3 weeks)
): StudentHistoryInsight {
  const studentAssignments = allAssignments.filter(
    (a) => a.studentId === studentId && (a.status === 'COMPLETED' || a.status === 'LOCKED_INCOMPLETE')
  );

  let easyTotal = 0;
  let easyCorrect = 0;
  let mediumTotal = 0;
  let mediumCorrect = 0;
  let hardTotal = 0;
  let hardCorrect = 0;

  const recentlyUsed = new Set<string>();
  const now = Date.now();
  const windowMs = repetitionWindowDays * 24 * 60 * 60 * 1000;

  for (const a of studentAssignments) {
    const testDate = a.completedAt ? new Date(a.completedAt).getTime() : a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const isRecent = now - testDate < windowMs;

    for (const q of a.questions) {
      if (isRecent) {
        recentlyUsed.add(q.questionId);
      }

      if (q.difficulty === 'Easy') {
        easyTotal++;
        if (q.isCorrect) easyCorrect++;
      } else if (q.difficulty === 'Medium') {
        mediumTotal++;
        if (q.isCorrect) mediumCorrect++;
      } else if (q.difficulty === 'Hard') {
        hardTotal++;
        if (q.isCorrect) hardCorrect++;
      }
    }
  }

  return {
    totalCompletedTests: studentAssignments.filter((a) => a.status === 'COMPLETED').length,
    easyAccuracy: easyTotal > 0 ? easyCorrect / easyTotal : -1, // -1 means no prior exposure
    mediumAccuracy: mediumTotal > 0 ? mediumCorrect / mediumTotal : -1,
    hardAccuracy: hardTotal > 0 ? hardCorrect / hardTotal : -1,
    recentlyUsedQuestionIds: recentlyUsed,
  };
}

export function selectRandomQuestionsForRuleEngine(
  targetCount: number,
  allQuestions: Question[],
  insights: StudentHistoryInsight
): Question[] {
  // Filter out recently used questions
  let eligibleQuestions = allQuestions.filter(
    (q) => !insights.recentlyUsedQuestionIds.has(q.id)
  );

  // If pool too small due to repetition window, allow eligible questions to expand back
  if (eligibleQuestions.length < targetCount) {
    eligibleQuestions = [...allQuestions];
  }

  // Determine allowed difficulty progression tiers:
  // Fresh student: -> Easy
  // Good Easy performance (>= 70%): -> Easy or Easy + Medium
  // Good Medium performance (>= 70%): -> Medium or Medium + Hard
  // Hard: -> Final difficulty level
  let targetDifficulties: QuestionDifficulty[] = ['Easy'];

  if (insights.totalCompletedTests === 0 || insights.easyAccuracy < 0) {
    // Fresh student
    targetDifficulties = ['Easy'];
  } else if (insights.mediumAccuracy >= 0.7) {
    // Good Medium performance -> Medium or Medium + Hard
    targetDifficulties = ['Medium', 'Hard'];
  } else if (insights.easyAccuracy >= 0.7) {
    // Good Easy performance -> Easy or Easy + Medium
    targetDifficulties = ['Easy', 'Medium'];
  } else {
    // Low performance -> keep in Easy
    targetDifficulties = ['Easy'];
  }

  // Filter pool matching progression difficulty
  let matchedQuestions = eligibleQuestions.filter((q) =>
    targetDifficulties.includes(q.difficulty)
  );

  // If matched questions not enough, backfill from remaining pool
  if (matchedQuestions.length < targetCount) {
    const remaining = eligibleQuestions.filter((q) => !matchedQuestions.includes(q));
    matchedQuestions = [...matchedQuestions, ...remaining];
  }

  // Shuffle candidate pool
  const shuffled = [...matchedQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, targetCount);
}
