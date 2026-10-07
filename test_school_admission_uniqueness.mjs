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

const adminHeaders = {
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
  console.log('TEST: SCHOOL-WISE ADMISSION NUMBER UNIQUENESS');
  console.log('====================================================\n');

  // 1. Setup: Ensure we have at least 2 distinct schools
  const schoolsRes = await fetch(`${BASE_URL}/api/schools`, { headers: adminHeaders });
  let schools = await schoolsRes.json();
  
  const timestamp = Date.now();
  let schoolA = schools[0];
  let schoolB = schools[1];

  if (!schoolB) {
    // Create second school
    const createSchoolBRes = await fetch(`${BASE_URL}/api/schools`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Test School B ${timestamp}`,
        code: `TSB${Math.floor(100 + Math.random() * 900)}`,
      }),
    });
    schoolB = await createSchoolBRes.json();
  }

  const schoolAId = schoolA.id || schoolA._id;
  const schoolBId = schoolB.id || schoolB._id;
  console.log(`[SETUP] School A: ${schoolA.name} (${schoolAId})`);
  console.log(`[SETUP] School B: ${schoolB.name} (${schoolBId})\n`);

  const admNoCommon = `ADM-${timestamp}-1001`;
  const admNoA2 = `ADM-${timestamp}-1002`;
  const admNoB2 = `ADM-${timestamp}-2002`;

  let student1InA;
  let student2InA;
  let student3InB;

  // Case 1: Create Student 1 in School A with admNoCommon -> MUST PASS
  await test('Create Student 1 in School A (admNoCommon) -> PASS', async () => {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        schoolId: schoolAId,
        studentName: 'Student 1 in School A',
        className: 'Class 6',
        section: 'A',
        schoolAdmissionNumber: admNoCommon,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.student && data.student.id, 'Expected student object');
    student1InA = data.student;
  });

  // Case 2: Same school (School A) + same admission number (admNoCommon) -> MUST FAIL ❌
  await test('Same school + same admission number -> MUST FAIL ❌', async () => {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        schoolId: schoolAId,
        studentName: 'Student 2 Duplicate in School A',
        className: 'Class 6',
        section: 'B',
        schoolAdmissionNumber: admNoCommon,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.error, 'Admission Number already exists in this school.');
  });

  // Case 3: Different school (School B) + same admission number (admNoCommon) -> MUST PASS ✅
  await test('Different school + same admission number -> MUST PASS ✅', async () => {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        schoolId: schoolBId,
        studentName: 'Student 3 in School B',
        className: 'Class 7',
        section: 'A',
        schoolAdmissionNumber: admNoCommon,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.student && data.student.id, 'Expected student object');
    student3InB = data.student;
  });

  // Case 4: Same school (School A) + different admission number (admNoA2) -> MUST PASS ✅
  await test('Same school + different admission number -> MUST PASS ✅', async () => {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        schoolId: schoolAId,
        studentName: 'Student 4 in School A',
        className: 'Class 8',
        section: 'A',
        schoolAdmissionNumber: admNoA2,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.student && data.student.id, 'Expected student object');
    student2InA = data.student;
  });

  // Case 5: Edit student (student2InA) to another student's admission number in same school (admNoCommon) -> MUST FAIL ❌
  await test('Edit student to another student\'s admission number in same school -> MUST FAIL ❌', async () => {
    const res = await fetch(`${BASE_URL}/api/students/${student2InA.id || student2InA.uniqueStudentId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        studentName: student2InA.studentName,
        className: 'Class 8',
        section: 'A',
        schoolAdmissionNumber: admNoCommon,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.error, 'Admission Number already exists in this school.');
  });

  // Case 6: Edit student keeping their own admission number (student1InA keeping admNoCommon) -> MUST PASS ✅
  await test('Edit student keeping their own admission number -> MUST PASS ✅', async () => {
    const res = await fetch(`${BASE_URL}/api/students/${student1InA.id || student1InA.uniqueStudentId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        studentName: 'Student 1 Updated Name',
        className: 'Class 6',
        section: 'A',
        schoolAdmissionNumber: admNoCommon,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.student.studentName, 'Student 1 Updated Name');
    assert.strictEqual(data.student.schoolAdmissionNumber, admNoCommon);
  });

  // Case 7: Edit student (student2InA in School A) to an admission number used in another school (admNoB2 or student3InB's admission number) -> MUST PASS ✅
  await test('Edit student to an admission number used in another school -> MUST PASS ✅', async () => {
    // admNoCommon is already used in School B by student3InB, but student2InA cannot use it in School A because student1InA has it in School A.
    // So let's create student 5 in School B with admNoB2:
    const resB2 = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        schoolId: schoolBId,
        studentName: 'Student 5 in School B',
        className: 'Class 9',
        section: 'C',
        schoolAdmissionNumber: admNoB2,
      }),
    });
    assert.strictEqual(resB2.status, 201, 'Created Student 5 in School B with admNoB2');

    // Now edit student2InA in School A to admNoB2. It should PASS because admNoB2 is only in School B!
    const res = await fetch(`${BASE_URL}/api/students/${student2InA.id || student2InA.uniqueStudentId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        studentName: student2InA.studentName,
        className: 'Class 8',
        section: 'A',
        schoolAdmissionNumber: admNoB2,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.student.schoolAdmissionNumber, admNoB2);
  });

  // Case 8: Concurrent duplicate creation in the same school -> MUST NOT create duplicates ❌
  await test('Concurrent duplicate creation in the same school -> MUST NOT create duplicates ❌', async () => {
    const concurrentAdmNo = `CONCUR-${timestamp}`;
    const promises = Array.from({ length: 5 }, (_, i) =>
      fetch(`${BASE_URL}/api/students`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          schoolId: schoolAId,
          studentName: `Concurrent Candidate ${i + 1}`,
          className: 'Class 7',
          section: 'A',
          schoolAdmissionNumber: concurrentAdmNo,
        }),
      }).then(async (r) => ({ status: r.status, data: await r.json() }))
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.status === 201).length;
    const failCount = results.filter((r) => r.status === 400).length;

    console.log(`[CONCURRENT TEST] 5 parallel creations: ${successCount} succeeded, ${failCount} rejected`);
    assert.strictEqual(successCount, 1, `Exactly 1 creation must succeed, got ${successCount}`);
    assert.strictEqual(failCount, 4, `Remaining 4 must be rejected, got ${failCount}`);
    for (const rejected of results.filter((r) => r.status === 400)) {
      assert.strictEqual(rejected.data.error, 'Admission Number already exists in this school.');
    }
  });

  console.log('\n====================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
