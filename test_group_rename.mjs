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

const headers = {
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
  console.log('TESTING QUESTION GROUP EDIT & GLOBAL SYNCHRONIZATION');
  console.log('====================================================\n');

  // 1. Fetch Question Groups
  const groupsRes = await fetch(`${BASE_URL}/api/question-groups`, { headers });
  assert.strictEqual(groupsRes.status, 200, 'Failed to fetch question groups');
  let groups = await groupsRes.json();

  // Find or create "Self-Awareness"
  let selfAwarenessGroup = groups.find((g) => g.name === 'Self-Awareness');
  if (!selfAwarenessGroup) {
    selfAwarenessGroup = groups.find((g) => g.name.toLowerCase().includes('self'));
  }

  if (!selfAwarenessGroup) {
    const createRes = await fetch(`${BASE_URL}/api/question-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Self-Awareness',
        description: 'Self-awareness questions and emotional intelligence',
      }),
    });
    assert.strictEqual(createRes.status, 201, 'Failed to create Self-Awareness group');
    selfAwarenessGroup = await createRes.json();
  }

  const groupId = selfAwarenessGroup.id || selfAwarenessGroup._id;
  const originalDescription = selfAwarenessGroup.description;
  console.log(`Target Question Group: ID=${groupId}, Name="${selfAwarenessGroup.name}"`);

  // Ensure there are questions belonging to this group
  let questionsRes = await fetch(`${BASE_URL}/api/questions?groupId=${groupId}`, { headers });
  let questions = await questionsRes.json();

  if (!Array.isArray(questions) || questions.length === 0) {
    const createQRes = await fetch(`${BASE_URL}/api/questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        groupId,
        difficulty: 'Easy',
        content: 'Identify an emotion that promotes self-awareness:',
        points: 5,
        timeSeconds: 30,
        options: ['Mindfulness', 'Distraction', 'Denial', 'Impulsiveness'],
        correctAnswer: 'Mindfulness',
        answerType: 'single',
      }),
    });
    assert.strictEqual(createQRes.status, 201, 'Failed to create question in group');
    const newQ = await createQRes.json();
    questions = [newQ];
  }

  const initialQuestionIds = questions.map((q) => q.id || q._id);
  console.log(`Initial Questions in Group: ${initialQuestionIds.length}`);

  // Fetch all schools for publishing a test if needed
  const schoolsRes = await fetch(`${BASE_URL}/api/schools`, { headers });
  const schools = await schoolsRes.json();
  const schoolId = schools[0]?.id || schools[0]?._id;

  // Ensure there is a published test using this question
  let pubTestId = null;
  const pubListRes = await fetch(`${BASE_URL}/api/publish-history`, { headers });
  const pubList = await pubListRes.json();
  if (Array.isArray(pubList) && pubList.length > 0) {
    pubTestId = pubList[0].publishId;
  }

  if (!pubTestId && schoolId) {
    const pubRes = await fetch(`${BASE_URL}/api/publish-assessment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        publishName: 'Historical Test for Group Sync',
        publishMode: 'Selected Questions',
        selectedQuestionIds: initialQuestionIds,
        targetSchools: [{ schoolId, classes: ['All Classes'], sections: ['All Sections'] }],
        startDate: '2026-01-01',
        startTime: '08:00 AM',
        endDate: '2026-12-31',
        endTime: '11:59 PM',
        shuffle: false,
      }),
    });
    if (pubRes.ok) {
      const pubData = await pubRes.json();
      pubTestId = pubData.publishedTest?.id || pubData.history?.publishId;
    }
  }

  // Record other groups count and names
  const otherGroupsBefore = groups.filter((g) => (g.id || g._id) !== groupId);

  // -------------------------------------------------------------------------
  // STEP 1 - 4: Click Edit & Change Name to "Self Awareness Test" & Save
  // -------------------------------------------------------------------------
  await test('Step 1-4: Admin renames "Self-Awareness" to "Self Awareness Test"', async () => {
    const renameRes = await fetch(`${BASE_URL}/api/question-groups/${groupId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Self Awareness Test' }),
    });
    assert.strictEqual(renameRes.status, 200, 'Rename API call failed');
    const data = await renameRes.json();
    assert.strictEqual(data.success, true, 'Response success is not true');
    assert.strictEqual(data.group.name, 'Self Awareness Test', 'Returned group name does not match');
  });

  // -------------------------------------------------------------------------
  // STEP 5: Verify the group ID remains unchanged
  // -------------------------------------------------------------------------
  await test('Step 5: Verify the group ID remains unchanged and only name changed', async () => {
    const getRes = await fetch(`${BASE_URL}/api/question-groups`, { headers });
    const allGroups = await getRes.json();
    const targetGroup = allGroups.find((g) => (g.id || g._id) === groupId);
    assert.ok(targetGroup, 'Target group not found by stable ID');
    assert.strictEqual(targetGroup.id || targetGroup._id, groupId, 'Group ID must match');
    assert.strictEqual(targetGroup.name, 'Self Awareness Test', 'Group name must be "Self Awareness Test"');
    assert.strictEqual(targetGroup.description, originalDescription, 'Group description must remain unchanged');
  });

  // -------------------------------------------------------------------------
  // STEP 6: Verify all questions still belong to the same group
  // -------------------------------------------------------------------------
  await test('Step 6: Verify all questions still belong to the same group ID', async () => {
    const getQRes = await fetch(`${BASE_URL}/api/questions?groupId=${groupId}`, { headers });
    const groupQs = await getQRes.json();
    assert.strictEqual(groupQs.length, initialQuestionIds.length, 'Questions count must match exactly');
    for (const q of groupQs) {
      assert.strictEqual(q.groupId, groupId, 'Question groupId must remain the same');
      assert.strictEqual(q.groupName, 'Self Awareness Test', 'Question groupName must be updated to new name');
    }
  });

  // -------------------------------------------------------------------------
  // STEP 7: Verify new name appears everywhere the group name is displayed, including historical records
  // -------------------------------------------------------------------------
  await test('Step 7.1: Question Groups Summary reflects "Self Awareness Test"', async () => {
    const getRes = await fetch(`${BASE_URL}/api/question-groups`, { headers });
    const allGroups = await getRes.json();
    const g = allGroups.find((item) => (item.id || item._id) === groupId);
    assert.strictEqual(g.name, 'Self Awareness Test');
  });

  await test('Step 7.2: Question Bank roster & question details reflect "Self Awareness Test"', async () => {
    const qRes = await fetch(`${BASE_URL}/api/questions`, { headers });
    const allQs = await qRes.json();
    const matchingQs = allQs.filter((q) => q.groupId === groupId);
    assert.ok(matchingQs.length > 0, 'No questions found for group');
    for (const q of matchingQs) {
      assert.strictEqual(q.groupName, 'Self Awareness Test');
    }
  });

  await test('Step 7.3: Publish Assessment & Published Test details reflect "Self Awareness Test"', async () => {
    if (pubTestId) {
      const pubRes = await fetch(`${BASE_URL}/api/published-tests/${pubTestId}`, { headers });
      if (pubRes.ok) {
        const testDetail = await pubRes.json();
        const testQuestions = testDetail.questionsSnapshot || [];
        const matched = testQuestions.filter((q) => q.groupId === groupId || initialQuestionIds.includes(q.id || q.questionId));
        for (const m of matched) {
          assert.strictEqual(m.groupName, 'Self Awareness Test', 'Published test snapshot question must have updated groupName');
        }
      }
    }
  });

  await test('Step 7.4: Publish History details reflect "Self Awareness Test"', async () => {
    if (pubTestId) {
      const histRes = await fetch(`${BASE_URL}/api/publish-history/${pubTestId}`, { headers });
      if (histRes.ok) {
        const histDetail = await histRes.json();
        const histQuestions = histDetail.questions || [];
        const matched = histQuestions.filter((q) => q.groupId === groupId || initialQuestionIds.includes(q.id || q.questionId));
        for (const m of matched) {
          assert.strictEqual(m.groupName, 'Self Awareness Test', 'Publish history detail question must have updated groupName');
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // STEP 8 & 9: Reload / re-fetch application data and verify persistence
  // -------------------------------------------------------------------------
  await test('Step 8 & 9: Reloading application confirms "Self Awareness Test" still appears everywhere', async () => {
    // Fresh fetch to simulate page reload
    const freshGroupsRes = await fetch(`${BASE_URL}/api/question-groups`, { headers });
    const freshGroups = await freshGroupsRes.json();
    const freshG = freshGroups.find((g) => (g.id || g._id) === groupId);
    assert.ok(freshG);
    assert.strictEqual(freshG.name, 'Self Awareness Test');

    const freshQsRes = await fetch(`${BASE_URL}/api/questions?groupId=${groupId}`, { headers });
    const freshQs = await freshQsRes.json();
    assert.strictEqual(freshQs.length, initialQuestionIds.length);
    for (const q of freshQs) {
      assert.strictEqual(q.groupName, 'Self Awareness Test');
    }
  });

  // -------------------------------------------------------------------------
  // STEP 10: Verify no other data changed
  // -------------------------------------------------------------------------
  await test('Step 10: Verify no other data changed (other groups unchanged, question content intact)', async () => {
    const allGroupsRes = await fetch(`${BASE_URL}/api/question-groups`, { headers });
    const currentGroups = await allGroupsRes.json();

    // Verify other groups were not modified
    for (const other of otherGroupsBefore) {
      const current = currentGroups.find((g) => (g.id || g._id) === (other.id || other._id));
      assert.ok(current, `Other group ${other.name} must exist`);
      assert.strictEqual(current.name, other.name, `Other group ${other.name} name must not change`);
    }

    // Verify questions inside target group did not change content, points, etc.
    const groupQsRes = await fetch(`${BASE_URL}/api/questions?groupId=${groupId}`, { headers });
    const groupQs = await groupQsRes.json();
    for (const q of groupQs) {
      const initial = questions.find((iq) => (iq.id || iq._id) === (q.id || q._id));
      if (initial) {
        assert.strictEqual(q.content, initial.content, 'Content must not change');
        assert.strictEqual(q.difficulty, initial.difficulty, 'Difficulty must not change');
        assert.strictEqual(q.points, initial.points, 'Points must not change');
        assert.strictEqual(q.timeSeconds, initial.timeSeconds, 'Timer must not change');
      }
    }
  });

  // Restore name back to "Self-Awareness"
  await fetch(`${BASE_URL}/api/question-groups/${groupId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: 'Self-Awareness' }),
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
