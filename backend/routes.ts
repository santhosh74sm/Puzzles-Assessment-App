import express from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import {
  UserModel,
  SchoolModel,
  QuestionGroupModel,
  QuestionModel,
  PublishedTestModel,
  StudentTestAssignmentModel,
  PublishHistoryModel,
  AssessmentTemplateModel,
} from '../database/models.ts';
import { generateToken, authenticate, requireRole } from './middleware/auth.ts';
import {
  computeStudentInsights,
  selectRandomQuestionsForRuleEngine,
} from './services/randomEngine.ts';
import type { Question, QuestionAttemptLog } from './types.ts';

const router = express.Router();

// Helper to convert Mongoose documents to clean JSON with 'id'
function formatDoc(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj._id && !obj.id) {
    obj.id = obj._id.toString();
  }
  delete obj.__v;
  return obj;
}

function formatDocs(docs: any[]): any[] {
  return docs.map(formatDoc);
}

// ==========================================
// 1. AUTHENTICATION & PASSWORD MANAGEMENT
// ==========================================

// Check if system has any users
router.get('/auth/setup-status', async (req: Request, res: Response) => {
  try {
    const usersCount = await UserModel.countDocuments();
    return res.json({ hasUsers: usersCount > 0, totalUsers: usersCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to check setup status', details: err.message });
  }
});

// Setup First Super Admin (Only allowed when database has 0 users)
router.post('/auth/setup-first-admin', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const count = await UserModel.countDocuments();
    if (count > 0) {
      return res.status(403).json({ error: 'Setup is already completed. Please sign in.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const firstSuperAdmin = await UserModel.create({
      username: username.trim(),
      role: 'super_admin',
      passwordHash: bcrypt.hashSync(password, salt),
      mustChangePassword: false,
    });

    const token = generateToken({
      userId: firstSuperAdmin._id.toString(),
      username: firstSuperAdmin.username,
      role: firstSuperAdmin.role,
    });

    return res.status(201).json({
      message: 'First Super Admin initialized successfully for production.',
      token,
      user: {
        id: firstSuperAdmin._id.toString(),
        username: firstSuperAdmin.username,
        role: firstSuperAdmin.role,
        mustChangePassword: false,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Unable to create administrator account. Please try again.', details: err.message });
  }
});

// Login (Supports Super Admin, School Admin, Student)
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const logMsg = `[Auth] ${new Date().toISOString()} Incoming login request for username: "${username}" (type: ${typeof username}, length: ${username ? username.length : 0}, passwordLength: ${password ? password.length : 0})\n`;
    try { fs.appendFileSync('/tmp/auth.log', logMsg); } catch (_) {}
    console.log(logMsg.trim());

    if (!username || !password) {
      console.warn('[Auth] Login rejected: missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedUsername = username.trim();
    // Case-insensitive lookup for username
    const user = await UserModel.findOne({
      username: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') },
    });

    if (!user) {
      const failMsg = `[Auth] ${new Date().toISOString()} Login failed: User "${trimmedUsername}" not found in database.\n`;
      try { fs.appendFileSync('/tmp/auth.log', failMsg); } catch (_) {}
      console.warn(failMsg.trim());
      return res.status(401).json({ error: 'Username or password is incorrect.' });
    }

    const isMatch =
      bcrypt.compareSync(password, user.passwordHash) ||
      (typeof password === 'string' &&
        (bcrypt.compareSync(password.trim(), user.passwordHash) ||
          bcrypt.compareSync(password.trimEnd(), user.passwordHash) ||
          bcrypt.compareSync(password.trimStart(), user.passwordHash)));
    const verifyMsg = `[Auth] ${new Date().toISOString()} Password verification for user "${user.username}": isMatch=${isMatch} (role: ${user.role}, mustChangePassword: ${user.mustChangePassword})\n`;
    try { fs.appendFileSync('/tmp/auth.log', verifyMsg); } catch (_) {}
    console.log(verifyMsg.trim());

    if (!isMatch) {
      const mismatchMsg = `[Auth] ${new Date().toISOString()} Login failed: Password mismatch for user "${user.username}".\n`;
      try { fs.appendFileSync('/tmp/auth.log', mismatchMsg); } catch (_) {}
      console.warn(mismatchMsg.trim());
      return res.status(401).json({ error: 'Username or password is incorrect.' });
    }

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      schoolId: user.schoolId,
      schoolName: user.schoolName,
      studentId: user.uniqueStudentId,
    });

    const successMsg = `[Auth] ${new Date().toISOString()} Login SUCCESS for user "${user.username}" (role: ${user.role}). Token generated.\n`;
    try { fs.appendFileSync('/tmp/auth.log', successMsg); } catch (_) {}
    console.log(successMsg.trim());

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        schoolId: user.schoolId,
        schoolName: user.schoolName,
        studentName: user.studentName,
        className: user.className,
        section: user.section,
        uniqueStudentId: user.uniqueStudentId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Username or password is incorrect.', details: err.message });
  }
});

// Force Password Change (Mandatory on first login)
router.post('/auth/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    }

    const user = await UserModel.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent setting password identical to username
    if (newPassword.toLowerCase() === user.username.toLowerCase()) {
      return res.status(400).json({ error: 'Please choose a password different from your username or ID' });
    }

    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(newPassword, salt);
    user.mustChangePassword = false;
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Unable to update password. Please try again.', details: err.message });
  }
});

// Get Current User Profile
router.get('/auth/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await UserModel.findById(req.user!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      schoolId: user.schoolId,
      schoolName: user.schoolName,
      studentName: user.studentName,
      className: user.className,
      section: user.section,
      uniqueStudentId: user.uniqueStudentId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to get user profile', details: err.message });
  }
});

// ==========================================
// 2. SUPER ADMIN: SCHOOL WORKSPACE MANAGEMENT
// ==========================================

// Create School
router.post('/schools', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'School name and code are required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existingSchool = await SchoolModel.findOne({ code: cleanCode });
    if (existingSchool) {
      return res.status(400).json({ error: `School code '${cleanCode}' is already registered.` });
    }

    const newSchool = await SchoolModel.create({
      name: name.trim(),
      code: cleanCode,
    });

    return res.status(201).json(formatDoc(newSchool));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create school', details: err.message });
  }
});

// List Schools
router.get('/schools', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'super_admin') {
      const schools = await SchoolModel.find();
      const sorted = formatDocs(schools).sort((a: any, b: any) =>
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      return res.json(sorted);
    }
    // School Admin or Student can only view their own school
    const schools = await SchoolModel.find({ _id: user.schoolId });
    return res.json(formatDocs(schools));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch schools', details: err.message });
  }
});

// List Admins for a School
router.get('/schools/:schoolId/admins', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const admins = await UserModel.find({ role: 'school_admin', schoolId }).sort({ createdAt: -1 });

    const formatted = admins.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      role: u.role,
      schoolId: u.schoolId,
      schoolName: u.schoolName,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
    }));
    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch school admins', details: err.message });
  }
});

// Create School Admin (Username = Admin ID, Password = Admin ID)
router.post('/schools/:schoolId/admins', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const school = await SchoolModel.findById(schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });

    // Generate unique Admin ID: e.g. ADM-SCH-XXXX
    let adminId = '';
    let isUnique = false;
    while (!isUnique) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      adminId = `ADM-${school.code}-${randomSuffix}`;
      const exists = await UserModel.findOne({ username: adminId });
      if (!exists) isUnique = true;
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(adminId, salt);

    const newAdmin = await UserModel.create({
      username: adminId,
      role: 'school_admin',
      passwordHash,
      mustChangePassword: true,
      schoolId: school._id.toString(),
      schoolName: school.name,
    });

    return res.status(201).json({
      admin: {
        id: newAdmin._id.toString(),
        username: newAdmin.username,
        role: newAdmin.role,
        schoolId: newAdmin.schoolId,
        schoolName: newAdmin.schoolName,
        mustChangePassword: newAdmin.mustChangePassword,
        createdAt: newAdmin.createdAt,
      },
      credentials: {
        username: adminId,
        initialPassword: adminId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create school admin', details: err.message });
  }
});

// Delete School Admin
router.delete('/schools/:schoolId/admins/:adminId', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { schoolId, adminId } = req.params;

    // Verify school exists
    const school = await SchoolModel.findById(schoolId);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Find the target school admin
    let admin = await UserModel.findById(adminId);
    if (!admin) {
      admin = await UserModel.findOne({ username: adminId });
    }

    if (!admin) {
      return res.status(404).json({ error: 'School admin not found' });
    }

    // Verify role is strictly school_admin
    if (admin.role !== 'school_admin') {
      return res.status(400).json({ error: 'User is not a school administrator' });
    }

    // Verify the admin belongs to the target school
    if (admin.schoolId !== school._id.toString()) {
      return res.status(400).json({ error: 'School admin does not belong to this school workspace' });
    }

    const adminUsername = admin.username;

    // Delete ONLY the target school admin user document from MongoDB Atlas
    await UserModel.findByIdAndDelete(admin._id);

    return res.json({
      success: true,
      message: `School Admin '${adminUsername}' deleted successfully from MongoDB Atlas.`,
      deletedId: admin._id.toString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete school admin', details: err.message });
  }
});

// Delete School Workspace (Super Admin Only)
router.delete('/schools/:schoolId', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;

    const school = await SchoolModel.findById(schoolId);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const schoolIdStr = school._id.toString();
    const schoolName = school.name;

    // 1. Delete all School Admin account(s) belonging to this school
    await UserModel.deleteMany({ role: 'school_admin', schoolId: schoolIdStr });

    // 2. Delete all Student account(s) belonging to this school
    await UserModel.deleteMany({ role: 'student', schoolId: schoolIdStr });

    // 3. Delete active / NOT_STARTED assessment assignments for this school
    // Note: Preserve historical COMPLETED, INCOMPLETE, LOCKED_INCOMPLETE attempt records!
    await StudentTestAssignmentModel.deleteMany({
      $or: [
        { schoolId: schoolIdStr },
        { schoolId: school.id },
        { schoolName: school.name },
      ],
      status: 'NOT_STARTED',
    });

    // 4. Delete the School Workspace record
    await SchoolModel.findByIdAndDelete(school._id);

    return res.json({
      success: true,
      message: `School Workspace '${schoolName}' and associated admin/student accounts have been deleted. Historical assessment data has been preserved.`,
      deletedSchoolId: schoolIdStr,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete school workspace', details: err.message });
  }
});

// ==========================================
// 3. STUDENT REGISTRATION & MANAGEMENT
// ==========================================

// Register Student
router.post('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      studentName,
      className,
      section,
      schoolAdmissionNumber,
      schoolId,
    } = req.body;

    if (!studentName || !className || !section || !schoolAdmissionNumber || !schoolId) {
      return res.status(400).json({ error: 'All student fields are required' });
    }

    // Role check: Only Super Admin or School Admin belonging to the school
    if (req.user!.role === 'school_admin' && req.user!.schoolId !== schoolId) {
      return res.status(403).json({ error: 'You cannot add students to another school' });
    }
    if (req.user!.role === 'student') {
      return res.status(403).json({ error: 'Students cannot create candidate profiles' });
    }

    const school = await SchoolModel.findById(schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });

    const cleanClass = className.replace(/[^0-9]/g, '') || '0';
    const cleanSection = section.trim().toUpperCase();

    if (!cleanSection) {
      return res.status(400).json({ error: 'Section is required' });
    }

    // Unique App Number / Student ID
    let uniqueStudentId = '';
    let isUnique = false;
    while (!isUnique) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      uniqueStudentId = `STU-${cleanClass}${cleanSection}-${randomSuffix}`;
      const exists = await UserModel.findOne({ username: uniqueStudentId });
      if (!exists) isUnique = true;
    }

    const salt = bcrypt.genSaltSync(10);
    const newStudent = await UserModel.create({
      username: uniqueStudentId,
      role: 'student',
      passwordHash: bcrypt.hashSync(uniqueStudentId, salt),
      mustChangePassword: true,
      schoolId: school._id.toString(),
      schoolName: school.name,
      studentName: studentName.trim(),
      className: className.trim(),
      section: cleanSection,
      schoolAdmissionNumber: schoolAdmissionNumber.trim(),
      uniqueStudentId,
    });

    return res.status(201).json({
      student: formatDoc(newStudent),
      credentials: {
        username: uniqueStudentId,
        initialPassword: uniqueStudentId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to register student', details: err.message });
  }
});

// List Students (Filtered by school, class, section, search)
router.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const { schoolId, className, section, search } = req.query as {
      schoolId?: string;
      className?: string;
      section?: string;
      search?: string;
    };

    const query: any = { role: 'student' };

    // Enforce access control
    if (req.user!.role === 'school_admin' || req.user!.role === 'student') {
      query.schoolId = req.user!.schoolId;
    } else if (schoolId) {
      query.schoolId = schoolId;
    }

    if (className) {
      query.className = { $regex: new RegExp(`^${className}$`, 'i') };
    }
    if (section) {
      query.section = { $regex: new RegExp(`^${section}$`, 'i') };
    }
    if (search) {
      const q = search.trim();
      query.$or = [
        { studentName: { $regex: q, $options: 'i' } },
        { schoolAdmissionNumber: { $regex: q, $options: 'i' } },
        { uniqueStudentId: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
      ];
    }

    const list = await UserModel.find(query, { passwordHash: 0 });
    const sorted = formatDocs(list).sort((a: any, b: any) =>
      (a.studentName || '').localeCompare(b.studentName || '', undefined, { numeric: true, sensitivity: 'base' })
    );
    return res.json(sorted);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list students', details: err.message });
  }
});

// Update Student Profile
router.put('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { studentName, schoolAdmissionNumber, className, section } = req.body;

    // Student role cannot edit profiles
    if (req.user!.role === 'student') {
      return res.status(403).json({ error: 'Students cannot edit student profiles' });
    }

    // Find student by ID or uniqueStudentId
    let student = await UserModel.findById(id);
    if (!student) {
      student = await UserModel.findOne({ uniqueStudentId: id });
    }
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Enforce school isolation for School Admins
    if (req.user!.role === 'school_admin' && student.schoolId !== req.user!.schoolId) {
      return res.status(403).json({ error: 'Forbidden: You cannot modify students from another school' });
    }

    // Validate required fields
    if (!studentName || !className || !section || !schoolAdmissionNumber) {
      return res.status(400).json({ error: 'Student Full Name, Admission Number, Class, and Section are all required' });
    }

    // Validate class (Class 1 to Class 12)
    const validClasses = [
      'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
      'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12',
    ];
    if (!validClasses.includes(className.trim())) {
      return res.status(400).json({ error: 'Class must be one of Class 1 through Class 12' });
    }

    const cleanSection = section.trim().toUpperCase();
    if (!cleanSection) {
      return res.status(400).json({ error: 'Section is required' });
    }

    // Update editable fields without altering username, uniqueStudentId, role, schoolId, or passwordHash
    student.studentName = studentName.trim();
    student.schoolAdmissionNumber = schoolAdmissionNumber.trim();
    student.className = className.trim();
    student.section = cleanSection;

    await student.save();

    // Also update studentName, className, and section in their existing StudentTestAssignment documents to keep names synchronized
    await StudentTestAssignmentModel.updateMany(
      { studentId: student.uniqueStudentId },
      {
        $set: {
          studentName: student.studentName,
          className: student.className,
          section: student.section,
        },
      }
    );

    return res.json({
      message: 'Student updated successfully',
      student: formatDoc(student),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update student', details: err.message });
  }
});

// Delete Student
router.delete('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Student role cannot delete profiles
    if (req.user!.role === 'student') {
      return res.status(403).json({ error: 'Students cannot delete student profiles' });
    }

    // Find student by ID or uniqueStudentId
    let student = await UserModel.findById(id);
    if (!student) {
      student = await UserModel.findOne({ uniqueStudentId: id });
    }
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Enforce school isolation for School Admins
    if (req.user!.role === 'school_admin' && student.schoolId !== req.user!.schoolId) {
      return res.status(403).json({ error: 'Forbidden: You cannot delete students from another school' });
    }

    const studentUniqueId = student.uniqueStudentId;

    // Delete student user account document from MongoDB Atlas
    await UserModel.findByIdAndDelete(student._id);

    // If student had test assignments, update their status record or clean up assignments safely without breaking overall history/test records
    await StudentTestAssignmentModel.deleteMany({ studentId: studentUniqueId });

    return res.json({
      success: true,
      message: `Student '${student.studentName}' (${studentUniqueId}) deleted successfully from MongoDB Atlas.`,
      deletedId: student._id.toString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete student', details: err.message });
  }
});

// ==========================================
// 4. QUESTION GROUPS & QUESTION BANK
// ==========================================

// Create Question Group
router.post('/question-groups', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const cleanName = name.trim();
    const existing = await QuestionGroupModel.findOne({
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
    });
    if (existing) {
      return res.status(400).json({ error: `Question Group '${cleanName}' already exists.` });
    }

    const newGroup = await QuestionGroupModel.create({
      name: cleanName,
      description: description?.trim() || '',
    });

    return res.status(201).json(formatDoc(newGroup));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create question group', details: err.message });
  }
});

// List Question Groups (With Question Counts & Difficulty Breakdown)
router.get('/question-groups', authenticate, async (req: Request, res: Response) => {
  try {
    const groups = await QuestionGroupModel.find().sort({ createdAt: 1 });
    const questions = await QuestionModel.find();

    const withCounts = groups.map((g) => {
      const gIdStr = g._id.toString();
      const gNameLower = (g.name || '').trim().toLowerCase();

      const groupQuestions = questions.filter((q) => {
        const qGroupId = (q.groupId || '').toString().trim();
        const qGroupName = (q.groupName || '').toString().trim().toLowerCase();
        return qGroupId === gIdStr || (qGroupName && qGroupName === gNameLower);
      });

      const easyQuestions = groupQuestions.filter((q) => (q.difficulty || '').trim().toLowerCase() === 'easy');
      const mediumQuestions = groupQuestions.filter((q) => (q.difficulty || '').trim().toLowerCase() === 'medium');
      const hardQuestions = groupQuestions.filter((q) => (q.difficulty || '').trim().toLowerCase() === 'hard');

      return {
        id: gIdStr,
        _id: gIdStr,
        name: g.name,
        description: g.description,
        createdAt: g.createdAt,
        questionCount: groupQuestions.length,
        easyCount: easyQuestions.length,
        mediumCount: mediumQuestions.length,
        hardCount: hardQuestions.length,
        breakdown: {
          Easy: {
            count: easyQuestions.length,
            questions: formatDocs(easyQuestions),
          },
          Medium: {
            count: mediumQuestions.length,
            questions: formatDocs(mediumQuestions),
          },
          Hard: {
            count: hardQuestions.length,
            questions: formatDocs(hardQuestions),
          },
        },
      };
    });

    return res.json(withCounts);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch question groups', details: err.message });
  }
});

// Add Question
router.post('/questions', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const {
      groupId,
      difficulty,
      content,
      timeSeconds,
      points,
      options,
      correctAnswer,
      metadata,
    } = req.body;

    if (!groupId || !difficulty || !content) {
      return res.status(400).json({ error: 'Question Group, Difficulty, and Content are required' });
    }

    const group = await QuestionGroupModel.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Question Group not found' });

    const parsedTime = timeSeconds !== undefined && timeSeconds !== null && timeSeconds !== ''
      ? Number(timeSeconds)
      : null;
    const parsedPoints = points !== undefined && points !== null && points !== ''
      ? Number(points)
      : null;
    const parsedCorrectAnswer = correctAnswer !== undefined && correctAnswer !== null && String(correctAnswer).trim() !== ''
      ? correctAnswer
      : null;

    const newQuestion = await QuestionModel.create({
      groupId: group._id.toString(),
      groupName: group.name,
      difficulty,
      content: content.trim(),
      timeSeconds: parsedTime,
      points: parsedPoints,
      options: options || [],
      correctAnswer: parsedCorrectAnswer,
      metadata: metadata || {},
    });

    return res.status(201).json(formatDoc(newQuestion));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add question', details: err.message });
  }
});

// List Questions (Filtered by groupId, difficulty)
router.get('/questions', authenticate, async (req: Request, res: Response) => {
  try {
    const { groupId, difficulty } = req.query as {
      groupId?: string;
      difficulty?: string;
    };

    const query: any = {};
    if (groupId) query.groupId = groupId;
    if (difficulty) query.difficulty = difficulty;

    const list = await QuestionModel.find(query).sort({ createdAt: -1 });

    // Sanitize correct answers for student callers
    if (req.user!.role === 'student') {
      const sanitized = list.map((q) => {
        const doc = formatDoc(q);
        delete doc.correctAnswer;
        return doc;
      });
      return res.json(sanitized);
    }

    return res.json(formatDocs(list));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list questions', details: err.message });
  }
});

// Delete Question from Question Bank (Super Admin Only)
// CRITICAL: Deleting from Question Bank removes ONLY the live/current Question Bank record.
// Lifecycle rule for student assignments:
// - COMPLETED, IN_PROGRESS, INCOMPLETE, LOCKED_INCOMPLETE: preserve historical snapshot permanently.
// - NOT_STARTED: safely remove the deleted question from pending unstarted assignments.
// - Historical PublishedTest & PublishHistory snapshots remain strictly preserved!
router.delete('/questions/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let question = await QuestionModel.findById(id);
    if (!question && mongoose.Types.ObjectId.isValid(id)) {
      question = await QuestionModel.findById(new mongoose.Types.ObjectId(id));
    }

    if (!question) {
      return res.status(404).json({ error: 'Question not found in Question Bank' });
    }

    const questionContentPreview = question.content
      ? question.content.substring(0, 60) + (question.content.length > 60 ? '...' : '')
      : 'Question';

    const deletedIdStr = question._id.toString();

    // 1. Delete ONLY the live Question Bank document from QuestionModel
    await QuestionModel.findByIdAndDelete(question._id);

    // 2. Safely remove the deleted question ONLY from NOT_STARTED student assignments that actually contain it
    // DO NOT touch COMPLETED, IN_PROGRESS, INCOMPLETE, or LOCKED_INCOMPLETE attempts!
    const matchingAssignments = await StudentTestAssignmentModel.find({
      status: 'NOT_STARTED',
      $or: [
        { 'questions.questionId': deletedIdStr },
        { 'questions.id': deletedIdStr },
        { 'questions._id': deletedIdStr },
      ],
    });
    for (const assign of matchingAssignments) {
      if (Array.isArray(assign.questions)) {
        const originalCount = assign.questions.length;
        assign.questions = assign.questions.filter((q: any) => {
          const qId = String(q.questionId || q.id || q._id || '');
          return qId !== deletedIdStr;
        });
        if (assign.questions.length !== originalCount) {
          assign.totalQuestions = assign.questions.length;
          await assign.save();
        }
      }
    }

    return res.json({
      success: true,
      message: `Question '${questionContentPreview}' deleted successfully from Question Bank. Historical assessment snapshots remain preserved.`,
      deletedId: deletedIdStr,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete question', details: err.message });
  }
});

// ==========================================
// 5. PUBLISH ASSESSMENT & TARGET METADATA
// ==========================================

// Helper to validate target configurations and detect duplicates/overlaps
async function validatePublishTargets(rawTargets: any[]) {
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    return { valid: false, error: 'At least one target configuration is required.' };
  }

  const normalizedTargets: Array<{
    targetIndex: number;
    schoolIds: string[];
    classes: string[];
    className: string;
    sections: string[];
    studentIds: string[];
  }> = [];

  for (let i = 0; i < rawTargets.length; i++) {
    const t = rawTargets[i];
    let sIds: string[] = [];
    if (Array.isArray(t.schoolIds) && t.schoolIds.length > 0) {
      sIds = t.schoolIds.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (t.schoolId) {
      sIds = Array.isArray(t.schoolId)
        ? t.schoolId.map((s: any) => String(s).trim()).filter(Boolean)
        : [String(t.schoolId).trim()].filter(Boolean);
    }

    if (sIds.length === 0) {
      return { valid: false, error: `Target ${i + 1}: Please select at least one target school workspace.` };
    }

    if (sIds.some((s) => s.toUpperCase() === 'ALL' || s.toUpperCase() === 'ALL_SCHOOLS')) {
      const allSchools = await SchoolModel.find({}, { _id: 1 });
      sIds = allSchools.map((s: any) => s._id.toString());
    }

    let classList: string[] = [];
    if (Array.isArray(t.classes)) {
      classList = t.classes.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (typeof t.className === 'string') {
      classList = t.className
        .split(',')
        .map((c: string) => c.trim())
        .filter(Boolean);
    }

    // Filter out 'ALL' and 'All Classes'
    classList = classList.filter(
      (c) => c.toUpperCase() !== 'ALL' && c.toLowerCase() !== 'all classes'
    );

    let secList: string[] = [];
    if (Array.isArray(t.sections)) {
      secList = Array.from(new Set(t.sections.map((s: any) => String(s).trim().toUpperCase()).filter(Boolean)));
    }

    let studentIdList: string[] = [];
    if (Array.isArray(t.studentIds)) {
      studentIdList = Array.from(
        new Set(
          t.studentIds
            .map((s: any) => String(s).trim())
            .filter((s: string) => s && s.toUpperCase() !== 'ALL')
        )
      );
    }

    normalizedTargets.push({
      targetIndex: i + 1,
      schoolIds: sIds,
      classes: classList,
      className: classList.length === 1 ? classList[0] : classList.join(', '),
      sections: secList,
      studentIds: studentIdList,
    });
  }

  // 1. Check for Exact Duplicate Targets
  for (let i = 0; i < normalizedTargets.length; i++) {
    for (let j = i + 1; j < normalizedTargets.length; j++) {
      const t1 = normalizedTargets[i];
      const t2 = normalizedTargets[j];

      const s1 = [...t1.schoolIds].sort().join(',');
      const s2 = [...t2.schoolIds].sort().join(',');
      const c1 = [...t1.classes].map((c) => c.toLowerCase()).sort().join(',');
      const c2 = [...t2.classes].map((c) => c.toLowerCase()).sort().join(',');
      const sec1 = [...t1.sections].sort().join(',');
      const sec2 = [...t2.sections].sort().join(',');
      const stu1 = [...(t1.studentIds || [])].sort().join(',');
      const stu2 = [...(t2.studentIds || [])].sort().join(',');

      if (s1 === s2 && c1 === c2 && sec1 === sec2 && stu1 === stu2) {
        return {
          valid: false,
          error: `Duplicate Target Detected: Target ${t1.targetIndex} and Target ${t2.targetIndex} are exact duplicates with identical School(s), Class(es), Section(s), and Student(s). Please remove or edit one of the duplicate targets.`,
        };
      }
    }
  }

  // 2. Query actual students from MongoDB Atlas for each target
  const targetStudentsMap: any[][] = [];
  for (let i = 0; i < normalizedTargets.length; i++) {
    const t = normalizedTargets[i];
    const q: any = {
      role: 'student',
      schoolId: { $in: t.schoolIds },
    };
    if (t.classes.length === 1) {
      q.className = { $regex: new RegExp(`^${t.classes[0]}$`, 'i') };
    } else if (t.classes.length > 1) {
      q.className = { $in: t.classes.map((c) => new RegExp(`^${c}$`, 'i')) };
    }
    if (t.sections.length > 0) {
      q.section = { $in: t.sections };
    }
    if (t.studentIds && t.studentIds.length > 0) {
      const validObjIds = t.studentIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
      q.$or = [
        { uniqueStudentId: { $in: t.studentIds } },
        { _id: { $in: validObjIds } },
        { username: { $in: t.studentIds } },
      ];
    }
    const students = await UserModel.find(q, {
      _id: 1,
      uniqueStudentId: 1,
      studentName: 1,
      schoolId: 1,
      schoolName: 1,
      className: 1,
      section: 1,
    }).lean();
    targetStudentsMap.push(students);
  }

  // 3. Detect Student-Level Overlaps based on actual student records in MongoDB Atlas
  const studentTargetMap = new Map<string, { student: any; targetIndices: number[] }>();
  for (let i = 0; i < normalizedTargets.length; i++) {
    for (const st of targetStudentsMap[i]) {
      const studentKey = String(st.uniqueStudentId || st._id).trim();
      if (!studentTargetMap.has(studentKey)) {
        studentTargetMap.set(studentKey, { student: st, targetIndices: [] });
      }
      studentTargetMap.get(studentKey)!.targetIndices.push(normalizedTargets[i].targetIndex);
    }
  }

  const conflictingPairs = new Map<string, { tA: number; tB: number; students: any[] }>();
  for (const [_, entry] of studentTargetMap.entries()) {
    if (entry.targetIndices.length > 1) {
      for (let a = 0; a < entry.targetIndices.length; a++) {
        for (let b = a + 1; b < entry.targetIndices.length; b++) {
          const tA = entry.targetIndices[a];
          const tB = entry.targetIndices[b];
          const pairKey = `${tA}-${tB}`;
          if (!conflictingPairs.has(pairKey)) {
            conflictingPairs.set(pairKey, { tA, tB, students: [] });
          }
          conflictingPairs.get(pairKey)!.students.push(entry.student);
        }
      }
    }
  }

  if (conflictingPairs.size > 0) {
    const conflictMsgs: string[] = [];
    for (const [_, info] of conflictingPairs.entries()) {
      const sampleNames = info.students
        .slice(0, 3)
        .map((s) => `${s.studentName || s.uniqueStudentId} (${s.className || 'Class'} Sec ${s.section || 'All'})`)
        .join(', ');
      conflictMsgs.push(
        `Target ${info.tA} and Target ${info.tB} overlap: ${info.students.length} student(s) would be assigned more than once (e.g. ${sampleNames}).`
      );
    }
    return {
      valid: false,
      error: `Overlapping Targets Detected: ${conflictMsgs.join(' ')} Please adjust your target configurations to avoid assigning the same students multiple times.`,
    };
  }

  // 4. Also check Logical Overlap (e.g. in case schools currently have no registered students yet)
  for (let i = 0; i < normalizedTargets.length; i++) {
    for (let j = i + 1; j < normalizedTargets.length; j++) {
      const t1 = normalizedTargets[i];
      const t2 = normalizedTargets[j];

      const sharedSchools = t1.schoolIds.filter((id) => t2.schoolIds.includes(id));
      if (sharedSchools.length > 0) {
        const classOverlap =
          t1.classes.length === 0 ||
          t2.classes.length === 0 ||
          t1.classes.some((c) => t2.classes.map((x) => x.toLowerCase()).includes(c.toLowerCase()));
        const sectionOverlap =
          t1.sections.length === 0 ||
          t2.sections.length === 0 ||
          t1.sections.some((sec) => t2.sections.includes(sec));

        const studentOverlap =
          !t1.studentIds?.length ||
          !t2.studentIds?.length ||
          t1.studentIds.includes('ALL') ||
          t2.studentIds.includes('ALL') ||
          t1.studentIds.some((id: string) => t2.studentIds!.includes(id));

        if (classOverlap && sectionOverlap && studentOverlap) {
          const c1Desc = t1.classes.length > 0 ? t1.classes.join(' + ') : 'All Classes';
          const c2Desc = t2.classes.length > 0 ? t2.classes.join(' + ') : 'All Classes';
          return {
            valid: false,
            error: `Target Conflict Detected: Target ${t1.targetIndex} and Target ${t2.targetIndex} have overlapping criteria on common school(s), class (${c1Desc} vs ${c2Desc}), sections, and students. Please refine them to be mutually exclusive.`,
          };
        }
      }
    }
  }

  return {
    valid: true,
    normalizedTargets,
    targetStudentsMap,
  };
}

// Helper to verify whether a student matches the targets of a published test
export function isStudentTargetedByPublishedTest(
  student: any,
  pubTest: any,
  totalSchoolsCount?: number
): boolean {
  if (!pubTest || !student) return false;

  const targetList = Array.isArray(pubTest.targets) && pubTest.targets.length > 0
    ? pubTest.targets
    : pubTest.target
    ? [pubTest.target]
    : [];

  if (targetList.length === 0) return false;

  const studentSchoolId = student.schoolId ? String(student.schoolId).trim() : '';
  const studentSchoolName = student.schoolName ? String(student.schoolName).trim().toLowerCase() : '';
  const studentClass = student.className ? String(student.className).trim().toLowerCase() : '';
  const studentSection = student.section ? String(student.section).trim().toUpperCase() : '';
  const studentKeys = [
    student.uniqueStudentId ? String(student.uniqueStudentId).trim() : '',
    student.username ? String(student.username).trim() : '',
    student._id ? String(student._id).trim() : '',
    student.id ? String(student.id).trim() : '',
  ].filter(Boolean);

  for (const t of targetList) {
    if (!t) continue;

    // 1. School check
    const sIds: string[] = [];
    if (Array.isArray(t.schoolIds)) {
      sIds.push(...t.schoolIds.map((s: any) => String(s).trim()).filter(Boolean));
    } else if (t.schoolId) {
      sIds.push(...(Array.isArray(t.schoolId) ? t.schoolId.map((s: any) => String(s).trim()) : [String(t.schoolId).trim()]).filter(Boolean));
    }

    const sNames: string[] = [];
    if (Array.isArray(t.schoolNames)) {
      sNames.push(...t.schoolNames.map((s: any) => String(s).trim().toLowerCase()).filter(Boolean));
    } else if (t.schoolName) {
      sNames.push(...String(t.schoolName).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    }

    const isAllSchools =
      t.isAllSchools === true ||
      sIds.some((s) => s.toUpperCase() === 'ALL' || s.toUpperCase() === 'ALL_SCHOOLS') ||
      sNames.some((n) => n === 'all' || n === 'all schools');

    const matchSchool =
      isAllSchools ||
      (studentSchoolId && sIds.includes(studentSchoolId)) ||
      (studentSchoolName && sNames.includes(studentSchoolName));

    if (!matchSchool) continue;

    // 2. Class check
    const cList: string[] = [];
    if (Array.isArray(t.classes)) {
      cList.push(...t.classes.map((c: any) => String(c).trim().toLowerCase()).filter(Boolean));
    } else if (t.className) {
      cList.push(...String(t.className).split(',').map((c) => c.trim().toLowerCase()).filter(Boolean));
    }

    const isAllClasses =
      cList.length === 0 ||
      cList.some((c) => c === 'all' || c === 'all classes');

    const matchClass =
      isAllClasses ||
      (studentClass && cList.includes(studentClass));

    if (!matchClass) continue;

    // 3. Section check
    const secList: string[] = [];
    if (Array.isArray(t.sections)) {
      secList.push(...t.sections.map((s: any) => String(s).trim().toUpperCase()).filter(Boolean));
    } else if (t.section) {
      secList.push(...String(t.section).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
    }

    const isAllSections =
      secList.length === 0 ||
      secList.some((s) => s === 'ALL' || s === 'ALL SECTIONS');

    const matchSection =
      isAllSections ||
      (studentSection && secList.includes(studentSection));

    if (!matchSection) continue;

    // 4. Student check
    const stuList: string[] = [];
    if (Array.isArray(t.studentIds)) {
      stuList.push(...t.studentIds.map((s: any) => String(s).trim()).filter(Boolean));
    }

    const isAllStudents =
      stuList.length === 0 ||
      stuList.some((s) => s.toUpperCase() === 'ALL' || s.toUpperCase() === 'ALL_STUDENTS' || s.toLowerCase() === 'all students');

    const matchStudent =
      isAllStudents ||
      stuList.some((sId) => studentKeys.includes(sId));

    if (!matchStudent) continue;

    // All criteria matched for this target!
    return true;
  }

  return false;
}

// Target Configuration Validation Endpoint
router.post('/publish/validate-targets', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { targets } = req.body;
    const result = await validatePublishTargets(targets);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }
    return res.json({ valid: true, message: 'All target configurations are valid and conflict-free.' });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: 'Failed to validate targets', details: err.message });
  }
});

// Dynamic Class List for Target Configuration
// Fetches unique classes from actual students in MongoDB Atlas matching selected school(s)
router.get('/target-classes', authenticate, async (req: Request, res: Response) => {
  try {
    const { schoolIds } = req.query as { schoolIds?: string };

    let schoolIdList: string[] = [];
    if (schoolIds) {
      schoolIdList = schoolIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (schoolIdList.some((s) => s.toUpperCase() === 'ALL' || s.toUpperCase() === 'ALL_SCHOOLS')) {
      const allSchools = await SchoolModel.find({}, { _id: 1 });
      schoolIdList = allSchools.map((s: any) => s._id.toString());
    }

    // Role-based restrictions if not super_admin
    if (req.user!.role === 'school_admin' || req.user!.role === 'student') {
      if (req.user!.schoolId) {
        schoolIdList = [req.user!.schoolId];
      }
    }

    if (schoolIdList.length === 0) {
      return res.json({ classes: [] });
    }

    const query: any = {
      role: 'student',
      schoolId: { $in: schoolIdList },
    };

    const rawClasses = await UserModel.distinct('className', query);

    const cleanClasses = Array.from(
      new Set(
        rawClasses
          .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
          .map((c: string) => c.trim())
      )
    ).sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return res.json({ classes: cleanClasses });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch dynamic classes', details: err.message });
  }
});

// Dynamic Section List for Target Configuration
// Fetches unique sections from actual students in MongoDB Atlas matching selected school(s) and optional class(es)
router.get('/target-sections', authenticate, async (req: Request, res: Response) => {
  try {
    const { schoolIds, className, classes } = req.query as {
      schoolIds?: string;
      className?: string;
      classes?: string;
    };

    let schoolIdList: string[] = [];
    if (schoolIds) {
      schoolIdList = schoolIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (schoolIdList.some((s) => s.toUpperCase() === 'ALL' || s.toUpperCase() === 'ALL_SCHOOLS')) {
      const allSchools = await SchoolModel.find({}, { _id: 1 });
      schoolIdList = allSchools.map((s: any) => s._id.toString());
    }

    // Role-based restrictions if not super_admin
    if (req.user!.role === 'school_admin' || req.user!.role === 'student') {
      if (req.user!.schoolId) {
        schoolIdList = [req.user!.schoolId];
      }
    }

    if (schoolIdList.length === 0) {
      return res.json({ sections: [] });
    }

    const query: any = {
      role: 'student',
      schoolId: { $in: schoolIdList },
    };

    let classList: string[] = [];
    if (classes) {
      classList = classes
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    } else if (className) {
      classList = [className.trim()].filter(Boolean);
    }

    classList = classList.filter(
      (c) => c.toUpperCase() !== 'ALL' && c.toLowerCase() !== 'all classes'
    );

    if (classList.length === 1) {
      query.className = { $regex: new RegExp(`^${classList[0]}$`, 'i') };
    } else if (classList.length > 1) {
      query.className = {
        $in: classList.map((c) => new RegExp(`^${c}$`, 'i')),
      };
    }

    const rawSections = await UserModel.distinct('section', query);

    const cleanSections = Array.from(
      new Set(
        rawSections
          .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim().toUpperCase())
      )
    ).sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return res.json({ sections: cleanSections });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch dynamic sections', details: err.message });
  }
});

// Dynamic Student List for Target Configuration
// Fetches students from MongoDB Atlas matching selected school(s), class(es), and section(s)
router.get('/target-students', authenticate, async (req: Request, res: Response) => {
  try {
    const { schoolIds, classes, sections } = req.query as {
      schoolIds?: string;
      classes?: string;
      sections?: string;
    };

    let schoolIdList: string[] = [];
    if (schoolIds) {
      schoolIdList = schoolIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (schoolIdList.some((s) => s.toUpperCase() === 'ALL' || s.toUpperCase() === 'ALL_SCHOOLS')) {
      const allSchools = await SchoolModel.find({}, { _id: 1 });
      schoolIdList = allSchools.map((s: any) => s._id.toString());
    }

    if (req.user!.role === 'school_admin' || req.user!.role === 'student') {
      if (req.user!.schoolId) {
        schoolIdList = [req.user!.schoolId];
      }
    }

    if (schoolIdList.length === 0) {
      return res.json({ students: [] });
    }

    const query: any = {
      role: 'student',
      schoolId: { $in: schoolIdList },
    };

    let classList: string[] = [];
    if (classes) {
      classList = classes
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c && c.toUpperCase() !== 'ALL' && c.toLowerCase() !== 'all classes');
    }

    if (classList.length === 1) {
      query.className = { $regex: new RegExp(`^${classList[0]}$`, 'i') };
    } else if (classList.length > 1) {
      query.className = {
        $in: classList.map((c) => new RegExp(`^${c}$`, 'i')),
      };
    }

    let sectionList: string[] = [];
    if (sections) {
      sectionList = sections
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s && s !== 'ALL' && s !== 'ALL SECTIONS');
    }

    if (sectionList.length === 1) {
      query.section = { $regex: new RegExp(`^${sectionList[0]}$`, 'i') };
    } else if (sectionList.length > 1) {
      query.section = {
        $in: sectionList.map((s) => new RegExp(`^${s}$`, 'i')),
      };
    }

    const rawStudents = await UserModel.find(query, {
      _id: 1,
      uniqueStudentId: 1,
      studentName: 1,
      schoolAdmissionNumber: 1,
      username: 1,
      className: 1,
      section: 1,
      schoolId: 1,
      schoolName: 1,
    });

    const formatted = formatDocs(rawStudents);
    const sorted = formatted.sort((a: any, b: any) =>
      (a.studentName || '').localeCompare(b.studentName || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );

    return res.json({ students: sorted });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch target students', details: err.message });
  }
});

router.post('/publish', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const {
      publishName,
      publishMode,
      target,
      targets,
      startDate,
      startTime,
      endDate,
      endTime,
      selectedQuestionIds,
      randomCount,
      shuffle,
    } = req.body;

    const targetList = Array.isArray(targets) && targets.length > 0 ? targets : target ? [target] : [];

    if (!publishName || !publishMode || targetList.length === 0 || !startDate || !endDate) {
      return res.status(400).json({ error: 'Publish Name, Mode, at least one Target Configuration, and Dates are mandatory.' });
    }

    if (publishMode === 'Selected Questions' && (!selectedQuestionIds || selectedQuestionIds.length === 0)) {
      return res.status(400).json({ error: 'Please select at least 1 question for Selected Questions mode.' });
    }

    if (publishMode === 'Random Questions') {
      const eligibleQDocs = await QuestionModel.find({ _id: { $in: selectedQuestionIds || [] } });
      const eligiblePool: Question[] = formatDocs(eligibleQDocs);
      if (eligiblePool.length === 0) {
        return res.status(400).json({ error: '0 eligible questions are available. Select at least one Group and Difficulty.' });
      }
      const count = Number(randomCount) || 0;
      if (count <= 0) {
        return res.status(400).json({ error: 'Please specify a valid number of questions per student.' });
      }
      if (count > eligiblePool.length) {
        return res.status(400).json({ error: `Only ${eligiblePool.length} eligible questions are available. You cannot assign ${count} questions per student.` });
      }
    }

    // Validate duplicate & overlapping targets across the assessment
    const validation = await validatePublishTargets(targetList);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const allTargetSchoolIds = Array.from(
      new Set(validation.normalizedTargets!.flatMap((t) => t.schoolIds))
    );

    const schools = await SchoolModel.find({ _id: { $in: allTargetSchoolIds } });
    if (schools.length === 0) {
      return res.status(404).json({ error: 'Selected target school(s) not found.' });
    }

    const schoolMap = new Map<string, any>(schools.map((s: any) => [s._id.toString(), s]));

    // Deduplicate candidate students across all targets using uniqueStudentId / _id
    const uniqueStudentsMap = new Map<string, any>();
    for (const studentList of validation.targetStudentsMap!) {
      for (const student of studentList) {
        const key = String(student.uniqueStudentId || student._id).trim();
        if (!uniqueStudentsMap.has(key)) {
          uniqueStudentsMap.set(key, student);
        }
      }
    }

    const candidateStudents = Array.from(uniqueStudentsMap.values());
    if (candidateStudents.length === 0) {
      return res.status(400).json({ error: 'No students found matching the selected target criteria across all targets.' });
    }

    const allTargetSchoolNames = allTargetSchoolIds.map((id) => schoolMap.get(id)?.name || id);
    const combinedSchoolNames = allTargetSchoolNames.join(', ');
    const allTargetClasses = Array.from(
      new Set(
        validation.normalizedTargets!.flatMap((t) =>
          t.classes.length > 0 ? t.classes : ['All Classes']
        )
      )
    );
    const allTargetSections = Array.from(new Set(validation.normalizedTargets!.flatMap((t) => t.sections)));

    const targetsRecord = validation.normalizedTargets!.map((nt) => {
      const sNames = nt.schoolIds.map((id) => schoolMap.get(id)?.name || id);
      return {
        schoolIds: nt.schoolIds,
        schoolNames: sNames,
        classes: nt.classes.length > 0 ? nt.classes : ['All Classes'],
        sections: nt.sections,
        studentIds: nt.studentIds || [],
      };
    });

    const allQuestionsDocs = await QuestionModel.find({ _id: { $in: selectedQuestionIds || [] } });
    const allQuestions: Question[] = formatDocs(allQuestionsDocs);

    const eligibleQuestionsSnapshot = allQuestions
      .filter((q) => (selectedQuestionIds || []).includes(q.id))
      .map((q) => ({
        id: q.id,
        questionId: q.id,
        groupName: (q.groupName || 'General').trim(),
        difficulty: (q.difficulty || 'Medium').trim(),
        content: q.content,
        points: q.points != null ? Number(q.points) : null,
        timeAllowedSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
        timeSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
        options: q.options || [],
        metadata: q.metadata || {},
        pairs: q.metadata?.pairs || [],
      }));

    const allTargetStudentIds = Array.from(
      new Set(validation.normalizedTargets!.flatMap((t) => t.studentIds || []))
    );

    // Create Published Test Record with targets array
    const newPublish = await PublishedTestModel.create({
      publishName: publishName.trim(),
      publishMode,
      target: {
        schoolId: allTargetSchoolIds[0] || '',
        schoolIds: allTargetSchoolIds,
        schoolName: combinedSchoolNames,
        schoolNames: allTargetSchoolNames,
        classes: allTargetClasses,
        sections: allTargetSections,
        studentIds: allTargetStudentIds,
      },
      targets: targetsRecord,
      startDate,
      startTime: startTime || '00:00',
      endDate,
      endTime: endTime || '23:59',
      questionIds: selectedQuestionIds || [],
      questionsSnapshot: eligibleQuestionsSnapshot,
      randomCount: randomCount ? Number(randomCount) : undefined,
      shuffle: Boolean(shuffle),
      createdBy: req.user!.username,
      status: 'ACTIVE',
      isPaused: false,
      publishedAt: new Date(),
    });

    const publishedTestId = newPublish._id.toString();
    const newAssignments: any[] = [];

    // Pre-fetch past assignments only for candidate students if in Random mode
    const candidateStudentIds = candidateStudents.map((s) => s.uniqueStudentId).filter(Boolean);
    const pastAssignmentsDocs = publishMode === 'Random Questions' && candidateStudentIds.length > 0
      ? await StudentTestAssignmentModel.find(
          { studentId: { $in: candidateStudentIds } },
          { studentId: 1, questions: 1, status: 1, scoreOutOf100: 1, startedAt: 1, completedAt: 1 }
        )
      : [];
    const pastAssignments = formatDocs(pastAssignmentsDocs);

    // Create assignments for every unique target student (guarantees exactly 1 assignment per student)
    for (const student of candidateStudents) {
      let studentQuestionList: Question[] = [];

      if (publishMode === 'Selected Questions') {
        const qMap = new Map(allQuestions.map((q) => [q.id, q]));
        const orderedQuestions = (selectedQuestionIds || [])
          .map((id: string) => qMap.get(id))
          .filter(Boolean) as Question[];

        if (shuffle) {
          studentQuestionList = [...orderedQuestions];
          for (let i = studentQuestionList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [studentQuestionList[i], studentQuestionList[j]] = [studentQuestionList[j], studentQuestionList[i]];
          }
        } else {
          studentQuestionList = [...orderedQuestions];
        }
      } else {
        const insights = computeStudentInsights(student.uniqueStudentId!, pastAssignments);
        const candidatePool = allQuestions.filter((q) => (selectedQuestionIds || []).includes(q.id));
        studentQuestionList = selectRandomQuestionsForRuleEngine(
          Number(randomCount) || 5,
          candidatePool.length > 0 ? candidatePool : allQuestions,
          insights
        );
      }

      const questionLogs: QuestionAttemptLog[] = studentQuestionList.map((q) => ({
        questionId: q.id,
        groupName: q.groupName,
        difficulty: q.difficulty,
        content: q.content,
        points: q.points != null ? Number(q.points) : null,
        studentAnswer: null,
        correctAnswer: q.correctAnswer ?? null,
        isCorrect: false,
        timeAllowedSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
        timeTakenSeconds: 0,
        earnedPoints: 0,
        options: q.options || [],
        metadata: q.metadata || {},
      }));

      const stSchool = schoolMap.get(student.schoolId);

      newAssignments.push({
        publishedTestId,
        publishName: publishName.trim(),
        studentId: student.uniqueStudentId!,
        studentName: student.studentName || '',
        schoolId: student.schoolId,
        schoolName: stSchool ? stSchool.name : (student.schoolName || ''),
        className: student.className || '',
        section: student.section || '',
        status: 'NOT_STARTED',
        totalQuestions: questionLogs.length,
        correctCount: 0,
        wrongCount: 0,
        totalPointsEarned: 0,
        scoreOutOf100: 0,
        totalTimeTakenSeconds: 0,
        questions: questionLogs,
      });
    }

    // Insert student assignments into MongoDB Atlas
    await StudentTestAssignmentModel.insertMany(newAssignments);

    // Create permanent history record in MongoDB Atlas
    const historyRecord = await PublishHistoryModel.create({
      publishId: publishedTestId,
      publishName: publishName.trim(),
      date: startDate,
      time: startTime || new Date().toLocaleTimeString(),
      startDate,
      startTime: startTime || '00:00',
      endDate,
      endTime: endTime || '23:59',
      schoolId: allTargetSchoolIds[0] || '',
      schoolName: combinedSchoolNames,
      schoolIds: allTargetSchoolIds,
      schoolNames: allTargetSchoolNames,
      classes: allTargetClasses.length > 0 ? allTargetClasses : ['All Classes'],
      sections: allTargetSections.length > 0 ? allTargetSections : ['All Sections'],
      totalRecipients: candidateStudents.length,
      targets: targetsRecord,
      publishMode,
      assignedQuestionsCount: publishMode === 'Selected Questions' ? (selectedQuestionIds?.length || 0) : (randomCount ? Number(randomCount) : 0),
      questionIds: selectedQuestionIds || [],
      questionsSnapshot: eligibleQuestionsSnapshot,
      randomCount: randomCount ? Number(randomCount) : undefined,
      completedCount: 0,
      incompleteCount: 0,
      status: 'ACTIVE',
      isPaused: false,
      publishedAt: new Date(),
      studentsStatus: candidateStudents.map((s) => ({
        studentId: s.uniqueStudentId!,
        studentName: s.studentName!,
        className: s.className!,
        section: s.section!,
        status: 'NOT_STARTED',
      })),
    });

    return res.status(201).json({
      message: `Assessment '${publishName}' published successfully to ${candidateStudents.length} students across ${schools.length} school(s).`,
      publishedTest: formatDoc(newPublish),
      assignedStudentCount: candidateStudents.length,
      totalAssignedStudents: candidateStudents.length,
      historyRecordId: historyRecord._id.toString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to publish assessment', details: err.message });
  }
});

// List All Published Tests
router.get('/published-tests', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const list = await PublishedTestModel.find().sort({ createdAt: -1 });
    return res.json(formatDocs(list));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch published tests', details: err.message });
  }
});

// Get a Specific Published Test for Edit Mode
router.get('/published-tests/:publishId', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { publishId } = req.params;
    const pubTest = await PublishedTestModel.findById(publishId);
    if (!pubTest) {
      return res.status(404).json({ error: 'Published test not found' });
    }
    const history = await PublishHistoryModel.findOne({ publishId });
    return res.json({
      ...formatDoc(pubTest),
      historyId: history?._id?.toString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch published test', details: err.message });
  }
});

// Update / Edit an Existing Published Assessment
const handleUpdatePublishedAssessment = async (req: Request, res: Response) => {
  try {
    const { publishId } = req.params;
    const {
      publishName,
      publishMode,
      target,
      targets,
      startDate,
      startTime,
      endDate,
      endTime,
      selectedQuestionIds,
      randomCount,
      shuffle,
    } = req.body;

    const pubTest = await PublishedTestModel.findById(publishId);
    if (!pubTest) {
      return res.status(404).json({ error: 'Assessment not found for update' });
    }

    const historyDoc = await PublishHistoryModel.findOne({ publishId });

    const targetList = Array.isArray(targets) && targets.length > 0 ? targets : target ? [target] : [];

    if (!publishName || !publishMode || targetList.length === 0 || !startDate || !endDate) {
      return res.status(400).json({ error: 'Publish Name, Mode, at least one Target Configuration, and Dates are mandatory.' });
    }

    if (publishMode === 'Selected Questions' && (!selectedQuestionIds || selectedQuestionIds.length === 0)) {
      return res.status(400).json({ error: 'Please select at least 1 question for Selected Questions mode.' });
    }

    if (publishMode === 'Random Questions') {
      const eligibleQDocs = await QuestionModel.find({ _id: { $in: selectedQuestionIds || [] } });
      const eligiblePool: Question[] = formatDocs(eligibleQDocs);
      if (eligiblePool.length === 0) {
        return res.status(400).json({ error: '0 eligible questions are available. Select at least one Group and Difficulty.' });
      }
      const count = Number(randomCount) || 0;
      if (count <= 0) {
        return res.status(400).json({ error: 'Please specify a valid number of questions per student.' });
      }
      if (count > eligiblePool.length) {
        return res.status(400).json({ error: `Only ${eligiblePool.length} eligible questions are available. You cannot assign ${count} questions per student.` });
      }
    }

    // Validate duplicate & overlapping targets across the assessment
    const validation = await validatePublishTargets(targetList);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const allTargetSchoolIds = Array.from(
      new Set(validation.normalizedTargets!.flatMap((t) => t.schoolIds))
    );
    const schools = await SchoolModel.find({ _id: { $in: allTargetSchoolIds } });
    const schoolMap = new Map<string, any>(schools.map((s: any) => [s._id.toString(), s]));

    // Deduplicate candidate students across all targets
    const uniqueStudentsMap = new Map<string, any>();
    for (const studentList of validation.targetStudentsMap!) {
      for (const student of studentList) {
        const key = String(student.uniqueStudentId || student._id).trim();
        if (!uniqueStudentsMap.has(key)) {
          uniqueStudentsMap.set(key, student);
        }
      }
    }

    const candidateStudents = Array.from(uniqueStudentsMap.values());
    if (candidateStudents.length === 0) {
      return res.status(400).json({ error: 'No students found matching the selected target criteria.' });
    }

    const allTargetSchoolNames = allTargetSchoolIds.map((id) => schoolMap.get(id)?.name || id);
    const combinedSchoolNames = allTargetSchoolNames.join(', ');
    const allTargetClasses = Array.from(
      new Set(
        validation.normalizedTargets!.flatMap((t) =>
          t.classes.length > 0 ? t.classes : ['All Classes']
        )
      )
    );
    const allTargetSections = Array.from(new Set(validation.normalizedTargets!.flatMap((t) => t.sections)));
    const allTargetStudentIds = Array.from(
      new Set(validation.normalizedTargets!.flatMap((t) => t.studentIds || []))
    );

    const targetsRecord = validation.normalizedTargets!.map((nt) => {
      const sNames = nt.schoolIds.map((id) => schoolMap.get(id)?.name || id);
      return {
        schoolIds: nt.schoolIds,
        schoolNames: sNames,
        classes: nt.classes.length > 0 ? nt.classes : ['All Classes'],
        sections: nt.sections,
        studentIds: nt.studentIds || [],
      };
    });

    // Prepare questions snapshot
    const allQuestionsDocs = await QuestionModel.find({ _id: { $in: selectedQuestionIds || [] } });
    const allQuestions: Question[] = formatDocs(allQuestionsDocs);
    const selectedQuestionsDocs = allQuestions.filter((q) => (selectedQuestionIds || []).includes(q.id));
    const eligibleQuestionsSnapshot = selectedQuestionsDocs.map((q) => ({
      id: q.id,
      questionId: q.id,
      groupName: (q.groupName || 'General').trim(),
      difficulty: (q.difficulty || 'Medium').trim(),
      content: q.content,
      points: q.points != null ? Number(q.points) : null,
      timeAllowedSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
      timeSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
      options: q.options || [],
      metadata: q.metadata || {},
      pairs: q.metadata?.pairs || [],
    }));

    // Update published test document with latest update timestamp
    const serverNow = new Date();
    pubTest.publishName = publishName.trim();
    pubTest.publishMode = publishMode;
    pubTest.target = {
      schoolId: allTargetSchoolIds[0] || '',
      schoolIds: allTargetSchoolIds,
      schoolName: combinedSchoolNames,
      schoolNames: allTargetSchoolNames,
      classes: allTargetClasses,
      sections: allTargetSections,
      studentIds: allTargetStudentIds,
    };
    pubTest.targets = targetsRecord;
    pubTest.startDate = startDate;
    pubTest.startTime = startTime || '00:00';
    pubTest.endDate = endDate;
    pubTest.endTime = endTime || '23:59';
    pubTest.questionIds = selectedQuestionIds || [];
    pubTest.questionsSnapshot = eligibleQuestionsSnapshot;
    pubTest.randomCount = randomCount ? Number(randomCount) : undefined;
    pubTest.shuffle = Boolean(shuffle);
    pubTest.publishedAt = serverNow;
    pubTest.updatedAt = serverNow;
    await pubTest.save();

    // Update existing student assignments publishName
    await StudentTestAssignmentModel.updateMany(
      { publishedTestId: publishId },
      { $set: { publishName: publishName.trim() } }
    );

    // Build lookup set of targeted students
    const targetStudentIdSet = new Set<string>();
    for (const student of candidateStudents) {
      if (student.uniqueStudentId) targetStudentIdSet.add(String(student.uniqueStudentId).trim());
      if (student.username) targetStudentIdSet.add(String(student.username).trim());
      if (student._id) targetStudentIdSet.add(String(student._id).trim());
      if (student.id) targetStudentIdSet.add(String(student.id).trim());
    }

    // Existing live assignments
    const existingAssignments = await StudentTestAssignmentModel.find({
      $or: [{ publishedTestId: publishId }, { publishedTestId: pubTest._id ? pubTest._id.toString() : publishId }],
    });

    // Revoke/remove assignments for students who are NO LONGER targeted AND have not started
    // Note: Preserve historical attempt records (COMPLETED, INCOMPLETE, LOCKED_INCOMPLETE, IN_PROGRESS) safely!
    const assignmentsToDelete: string[] = [];
    for (const a of existingAssignments) {
      if (!targetStudentIdSet.has(a.studentId)) {
        if (a.status === 'NOT_STARTED') {
          assignmentsToDelete.push(a._id.toString());
        }
      }
    }

    if (assignmentsToDelete.length > 0) {
      await StudentTestAssignmentModel.deleteMany({ _id: { $in: assignmentsToDelete } });
    }

    // Remaining live assignments after revocation
    const remainingAssignments = await StudentTestAssignmentModel.find({
      $or: [{ publishedTestId: publishId }, { publishedTestId: pubTest._id ? pubTest._id.toString() : publishId }],
    });
    const remainingAssignMap = new Map<string, any>();
    for (const a of remainingAssignments) {
      remainingAssignMap.set(a.studentId, a);
    }

    // Prepare questions for newly assigned students or update NOT_STARTED students
    const candidateStudentIds = candidateStudents.map((s) => s.uniqueStudentId).filter(Boolean);
    const pastAssignmentsDocs = publishMode === 'Random Questions' && candidateStudentIds.length > 0
      ? await StudentTestAssignmentModel.find(
          { studentId: { $in: candidateStudentIds } },
          { studentId: 1, questions: 1, status: 1, scoreOutOf100: 1, startedAt: 1, completedAt: 1 }
        )
      : [];
    const pastAssignments = formatDocs(pastAssignmentsDocs);

    // For any candidate student who does not have an assignment yet, create one safely
    const newAssignmentsToAdd: any[] = [];
    for (const student of candidateStudents) {
      const sId = (student.uniqueStudentId || student.username || student._id?.toString()).trim();
      const stSchool = schoolMap.get(student.schoolId);

      if (!remainingAssignMap.has(sId)) {
        let studentQuestionList = [...selectedQuestionsDocs];
        if (publishMode === 'Selected Questions') {
          if (shuffle) {
            studentQuestionList = [...selectedQuestionsDocs];
            for (let i = studentQuestionList.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [studentQuestionList[i], studentQuestionList[j]] = [studentQuestionList[j], studentQuestionList[i]];
            }
          }
        } else {
          const insights = computeStudentInsights(sId, pastAssignments);
          const candidatePool = allQuestions.filter((q) => (selectedQuestionIds || []).includes(q.id));
          studentQuestionList = selectRandomQuestionsForRuleEngine(
            Number(randomCount) || 5,
            candidatePool.length > 0 ? candidatePool : allQuestions,
            insights
          );
        }

        const questionLogs: QuestionAttemptLog[] = studentQuestionList.map((q) => ({
          questionId: q.id,
          groupName: q.groupName,
          difficulty: q.difficulty,
          content: q.content,
          points: q.points != null ? Number(q.points) : null,
          studentAnswer: null,
          correctAnswer: q.correctAnswer ?? null,
          isCorrect: false,
          timeAllowedSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
          timeTakenSeconds: 0,
          earnedPoints: 0,
          options: q.options || [],
          metadata: q.metadata || {},
        }));

        newAssignmentsToAdd.push({
          publishedTestId: publishId,
          publishName: publishName.trim(),
          studentId: sId,
          studentName: student.studentName || '',
          schoolId: student.schoolId,
          schoolName: stSchool ? stSchool.name : (student.schoolName || ''),
          className: student.className || '',
          section: student.section || '',
          status: 'NOT_STARTED',
          totalQuestions: questionLogs.length,
          correctCount: 0,
          wrongCount: 0,
          totalPointsEarned: 0,
          scoreOutOf100: 0,
          totalTimeTakenSeconds: 0,
          questions: questionLogs,
        });
      } else {
        // Student already exists: if status is NOT_STARTED, update school/class/section details & questions if needed
        const existing = remainingAssignMap.get(sId);
        if (existing.status === 'NOT_STARTED') {
          existing.schoolId = student.schoolId;
          existing.schoolName = stSchool ? stSchool.name : (student.schoolName || existing.schoolName);
          existing.className = student.className || existing.className;
          existing.section = student.section || existing.section;

          if (publishMode === 'Selected Questions') {
            let updatedList = [...selectedQuestionsDocs];
            if (shuffle) {
              for (let i = updatedList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [updatedList[i], updatedList[j]] = [updatedList[j], updatedList[i]];
              }
            }
            const questionLogs: QuestionAttemptLog[] = updatedList.map((q) => ({
              questionId: q.id,
              groupName: q.groupName,
              difficulty: q.difficulty,
              content: q.content,
              points: q.points != null ? Number(q.points) : null,
              studentAnswer: null,
              correctAnswer: q.correctAnswer ?? null,
              isCorrect: false,
              timeAllowedSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
              timeTakenSeconds: 0,
              earnedPoints: 0,
              options: q.options || [],
              metadata: q.metadata || {},
            }));
            existing.questions = questionLogs;
            existing.totalQuestions = questionLogs.length;
          }
          await existing.save();
        }
      }
    }

    if (newAssignmentsToAdd.length > 0) {
      await StudentTestAssignmentModel.insertMany(newAssignmentsToAdd);
    }

    // Refresh all live assignments for this published test
    const allCurrentAssignments = await StudentTestAssignmentModel.find({
      $or: [{ publishedTestId: publishId }, { publishedTestId: pubTest._id ? pubTest._id.toString() : publishId }],
    });
    const currentCompleted = allCurrentAssignments.filter((a) => a.status === 'COMPLETED').length;
    const currentIncomplete = allCurrentAssignments.filter((a) => a.status === 'INCOMPLETE' || a.status === 'LOCKED_INCOMPLETE').length;

    // Update PublishHistory record with latest update timestamp and updated recipient list
    if (historyDoc) {
      historyDoc.publishedAt = serverNow;
      historyDoc.updatedAt = serverNow;
      historyDoc.publishName = publishName.trim();
      historyDoc.publishMode = publishMode;
      historyDoc.startDate = startDate;
      historyDoc.startTime = startTime || '00:00';
      historyDoc.endDate = endDate;
      historyDoc.endTime = endTime || '23:59';
      historyDoc.schoolId = allTargetSchoolIds[0] || '';
      historyDoc.schoolName = combinedSchoolNames;
      historyDoc.schoolIds = allTargetSchoolIds;
      historyDoc.schoolNames = allTargetSchoolNames;
      historyDoc.classes = allTargetClasses.length > 0 ? allTargetClasses : ['All Classes'];
      historyDoc.sections = allTargetSections.length > 0 ? allTargetSections : ['All Sections'];
      historyDoc.targets = targetsRecord;
      historyDoc.totalRecipients = allCurrentAssignments.length;
      historyDoc.assignedQuestionsCount = publishMode === 'Selected Questions' ? (selectedQuestionIds?.length || 0) : (randomCount || 0);
      historyDoc.questionIds = selectedQuestionIds || [];
      historyDoc.questionsSnapshot = eligibleQuestionsSnapshot;
      historyDoc.randomCount = randomCount ? Number(randomCount) : undefined;
      historyDoc.completedCount = currentCompleted;
      historyDoc.incompleteCount = currentIncomplete;

      // Update studentsStatus:
      // Remove stale NOT_STARTED entries for students who are no longer targeted.
      // Keep students who are in allCurrentAssignments or who have a completed/incomplete attempt.
      const prevStatusMap = new Map<string, any>(
        (historyDoc.studentsStatus || []).map((s: any) => [s.studentId || s.uniqueStudentId, s])
      );

      const liveAssignMap = new Map<string, any>(allCurrentAssignments.map((a) => [a.studentId, a]));
      const updatedStudentsStatus: any[] = [];

      for (const a of allCurrentAssignments) {
        const prev = prevStatusMap.get(a.studentId);
        updatedStudentsStatus.push({
          studentId: a.studentId,
          uniqueStudentId: a.studentId,
          studentName: a.studentName || prev?.studentName || '',
          schoolId: a.schoolId || prev?.schoolId || '',
          schoolName: a.schoolName || prev?.schoolName || '',
          className: a.className || prev?.className || '',
          section: a.section || prev?.section || '',
          status: a.status,
          scoreOutOf100: a.scoreOutOf100 || 0,
          exitType: a.exitType || null,
          completionDate: prev?.completionDate,
          completionTime: prev?.completionTime,
        });
      }

      // Also preserve any previous historical attempts (status !== 'NOT_STARTED') for students not currently in live assignments
      for (const [sId, prev] of prevStatusMap.entries()) {
        if (!liveAssignMap.has(sId) && prev.status && prev.status !== 'NOT_STARTED') {
          updatedStudentsStatus.push(prev);
        }
      }

      historyDoc.studentsStatus = updatedStudentsStatus;
      await historyDoc.save();
    }

    return res.json({
      success: true,
      message: `Assessment '${publishName}' updated successfully. Total assigned: ${allCurrentAssignments.length} students.`,
      publishedTest: formatDoc(pubTest),
      totalAssignedStudents: allCurrentAssignments.length,
      publishedAt: serverNow,
      updatedAt: serverNow,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update assessment', details: err.message });
  }
};

router.put('/publish/:publishId', authenticate, requireRole('super_admin'), handleUpdatePublishedAssessment);
router.put('/published-tests/:publishId', authenticate, requireRole('super_admin'), handleUpdatePublishedAssessment);

// ==========================================
// 6. STUDENT ASSESSMENT PORTAL & EXECUTION
// ==========================================

// Get All Tests Assigned to Current Student
router.get('/student/tests', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'student') {
      return res.status(403).json({ error: 'Only student accounts can access candidate assessments' });
    }

    const studentId = req.user!.studentId || req.user!.username;
    const assignments = await StudentTestAssignmentModel.find({ studentId }).sort({ createdAt: -1 });

    const publishedTests = await PublishedTestModel.find({
      _id: { $in: assignments.map((a) => a.publishedTestId) },
    });
    const pubMap = new Map<string, any>();
    for (const pt of publishedTests) {
      pubMap.set(pt._id.toString(), pt);
    }

    const studentUser = (req.user!.userId ? await UserModel.findById(req.user!.userId).lean() : null) ||
      await UserModel.findOne({
        $or: [
          { uniqueStudentId: { $regex: new RegExp(`^${studentId}$`, 'i') } },
          { username: { $regex: new RegExp(`^${studentId}$`, 'i') } },
        ],
      }).lean();

    // Determine current date-time string in client timezone if provided, else server time
    const clientDateTimeHeader = req.headers['x-client-now'] as string;
    let currentDateTimeStr = '';
    if (clientDateTimeHeader && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(clientDateTimeHeader)) {
      currentDateTimeStr = clientDateTimeHeader.slice(0, 16);
    } else {
      const clientOffsetHeader = req.headers['x-timezone-offset'];
      const clientOffset = clientOffsetHeader !== undefined && clientOffsetHeader !== ''
        ? Number(clientOffsetHeader)
        : null;

      const nowMs = Date.now();
      const clientNow = clientOffset !== null && !isNaN(clientOffset)
        ? new Date(nowMs - (clientOffset * 60000))
        : new Date(nowMs);

      const clientYear = clientNow.getUTCFullYear();
      const clientMonth = String(clientNow.getUTCMonth() + 1).padStart(2, '0');
      const clientDay = String(clientNow.getUTCDate()).padStart(2, '0');
      const clientHour = String(clientNow.getUTCHours()).padStart(2, '0');
      const clientMin = String(clientNow.getUTCMinutes()).padStart(2, '0');
      currentDateTimeStr = `${clientYear}-${clientMonth}-${clientDay}T${clientHour}:${clientMin}`;
    }

    // Pre-fetch active question IDs only for question IDs present in student's NOT_STARTED tests
    const unstartedQuestionIds = Array.from(
      new Set(
        assignments
          .filter((a) => a.status === 'NOT_STARTED')
          .flatMap((a) => (a.questions || []).map((q: any) => String(q.questionId || q.id || q._id || '')).filter(Boolean))
      )
    );
    const activeQuestionsDocs = unstartedQuestionIds.length > 0
      ? await QuestionModel.find({ _id: { $in: unstartedQuestionIds } }, { _id: 1 }).lean()
      : [];
    const activeQuestionIdSet = new Set(activeQuestionsDocs.map((q: any) => q._id.toString()));

    const result: any[] = [];
    const staleAssignmentsToDelete: string[] = [];

    for (const a of assignments) {
      const pubId = a.publishedTestId?.toString ? a.publishedTestId.toString() : String(a.publishedTestId);
      const pub = pubMap.get(pubId);
      if (!pub) {
        continue;
      }

      // If test has NOT_STARTED, ensure student is still targeted under updated target configuration
      if (a.status === 'NOT_STARTED' && studentUser) {
        const isTargeted = isStudentTargetedByPublishedTest(studentUser, pub);
        if (!isTargeted) {
          staleAssignmentsToDelete.push(a._id.toString());
          continue;
        }
      }

      const doc = formatDoc(a);

      let isUpcoming = false;
      let isExpired = false;

      if (pub?.startDate && pub.startDate !== 'Today') {
        const startStr = `${pub.startDate}T${pub.startTime || '00:00'}`;
        if (currentDateTimeStr < startStr) {
          isUpcoming = true;
        }
      }

      if (pub?.endDate && pub.endDate !== 'Open') {
        const endStr = `${pub.endDate}T${pub.endTime || '23:59'}`;
        if (currentDateTimeStr > endStr) {
          isExpired = true;
        }
      }

      let activeQuestionsCount = (a.questions || []).length;
      if (a.status === 'NOT_STARTED') {
        const validActive = (a.questions || []).filter((q: any) => {
          const qId = String(q.questionId || q.id || q._id || '');
          return activeQuestionIdSet.has(qId);
        });
        activeQuestionsCount = validActive.length;
      }

      const isPaused = pub?.isPaused === true || pub?.status === 'PAUSED';
      const hasActiveQuestions = a.status !== 'NOT_STARTED' || activeQuestionsCount > 0;
      const canStart = a.status === 'NOT_STARTED' && !isUpcoming && !isExpired && !isPaused && hasActiveQuestions;

      result.push({
        ...doc,
        totalQuestions: activeQuestionsCount,
        assignmentId: a._id.toString(),
        id: a._id.toString(),
        publishedTestId: pubId,
        publishName: pub?.publishName || a.publishName,
        startDate: pub?.startDate || 'Today',
        startTime: pub?.startTime || '00:00',
        endDate: pub?.endDate || 'Open',
        endTime: pub?.endTime || '23:59',
        isUpcoming,
        isExpired,
        isPaused,
        canStart,
      });
    }

    if (staleAssignmentsToDelete.length > 0) {
      await StudentTestAssignmentModel.deleteMany({ _id: { $in: staleAssignmentsToDelete } });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch student tests', details: err.message });
  }
});

// Start an Assessment (Atomic Lock check: Can ONLY be started once from NOT_STARTED)
router.post('/student/tests/:assignmentId/start', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { assignmentId } = req.params;
    const studentId = req.user!.studentId || req.user!.username;

    const assignment = await StudentTestAssignmentModel.findById(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Test not found' });
    if (assignment.studentId !== studentId) return res.status(403).json({ error: 'Access denied' });

    // Block start if assessment is paused by admin or not found
    const pubTest = await PublishedTestModel.findById(assignment.publishedTestId);
    if (!pubTest) {
      return res.status(404).json({ error: 'Test not found' });
    }
    if (pubTest?.isPaused || pubTest?.status === 'PAUSED') {
      return res.status(403).json({ error: 'This test is temporarily paused. Please check back later.' });
    }

    // Verify student is still targeted under updated target configuration
    if (assignment.status === 'NOT_STARTED') {
      const studentUser = (req.user!.userId ? await UserModel.findById(req.user!.userId).lean() : null) ||
        await UserModel.findOne({
          $or: [
            { uniqueStudentId: { $regex: new RegExp(`^${studentId}$`, 'i') } },
            { username: { $regex: new RegExp(`^${studentId}$`, 'i') } },
          ],
        }).lean();
      if (studentUser && !isStudentTargetedByPublishedTest(studentUser, pubTest)) {
        await StudentTestAssignmentModel.deleteOne({ _id: assignment._id });
        return res.status(403).json({ error: 'You are no longer assigned to this test.' });
      }
    }

    // Strict One-Time Attempt Enforcement:
    // Only NOT_STARTED can be started.
    // If IN_PROGRESS, COMPLETED, or LOCKED_INCOMPLETE, reject restart.
    if (assignment.status === 'COMPLETED') {
      return res.status(400).json({ error: 'You have already completed this test.' });
    }
    if (assignment.status === 'LOCKED_INCOMPLETE' || assignment.status === 'INCOMPLETE') {
      return res.status(400).json({ error: 'This test ended early and cannot be reopened.' });
    }
    if (assignment.status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'This test has already been started. You can only take this test once.' });
    }
    if (assignment.status !== 'NOT_STARTED') {
      return res.status(400).json({ error: 'Only unstarted tests can be started.' });
    }

    // Defensive active question check:
    // Ensure that if any question was deleted from the active Question Bank while this assignment was NOT_STARTED,
    // that deleted question is excluded when starting.
    const allQuestionsDocs = await QuestionModel.find();
    const activeQuestionIdSet = new Set(allQuestionsDocs.map((q) => q._id.toString()));

    const activeQuestions = (assignment.questions || []).filter((q: any) => {
      const qId = String(q.questionId || q.id || q._id || '');
      return activeQuestionIdSet.has(qId);
    });

    if (activeQuestions.length === 0) {
      assignment.questions = [];
      assignment.totalQuestions = 0;
      await assignment.save();
      return res.status(400).json({
        error: 'This test cannot be started because its questions are no longer available in the Question Bank.',
      });
    }

    assignment.questions = activeQuestions;
    assignment.totalQuestions = activeQuestions.length;

    // Set startedAt and status to IN_PROGRESS on initial start (permanently saved in MongoDB Atlas)
    assignment.status = 'IN_PROGRESS';
    assignment.exitType = null;
    assignment.startedAt = new Date();
    await assignment.save();

    // Update student status in publish history
    await PublishHistoryModel.updateOne(
      { publishId: assignment.publishedTestId, 'studentsStatus.studentId': studentId },
      { $set: { 'studentsStatus.$.status': 'IN_PROGRESS', 'studentsStatus.$.exitType': null } }
    );

    const qMap = new Map<string, any>();
    for (const q of allQuestionsDocs) {
      qMap.set(q._id.toString(), q);
    }

    const sanitizedQuestions = assignment.questions.map((q: any) => {
      const fullQ = qMap.get(String(q.questionId || q.id || q._id));
      return {
        questionId: q.questionId || q.id || q._id,
        groupName: q.groupName || fullQ?.groupName || 'General',
        difficulty: q.difficulty || fullQ?.difficulty || 'Medium',
        content: q.content || fullQ?.content || 'Question',
        points: q.points != null ? Number(q.points) : (fullQ?.points != null ? Number(fullQ.points) : null),
        timeAllowedSeconds: q.timeAllowedSeconds != null ? Number(q.timeAllowedSeconds) : (fullQ?.timeSeconds != null ? Number(fullQ.timeSeconds) : null),
        options: (q.options && q.options.length > 0) ? q.options : (fullQ?.options || []),
        metadata: q.metadata || fullQ?.metadata || {},
        pairs: q.pairs || fullQ?.pairs || fullQ?.metadata?.pairs || q.metadata?.pairs || [],
        timeTakenSeconds: q.timeTakenSeconds || 0,
        studentAnswer: q.studentAnswer,
      };
    });

    const doc = formatDoc(assignment);
    return res.json({
      ...doc,
      assignmentId: assignment._id.toString(),
      id: assignment._id.toString(),
      questions: sanitizedQuestions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Unable to start test. Please try again.', details: err.message });
  }
});

// Helper to transition assessment to INCOMPLETE with distinct EXIT or LOGOUT tracking
async function markAssignmentIncomplete(
  assignmentId: string,
  studentId: string,
  exitType: 'EXIT' | 'LOGOUT',
  reason?: string
) {
  const assignment = await StudentTestAssignmentModel.findById(assignmentId);
  if (!assignment) return { error: 'Assessment not found', code: 404 };
  if (assignment.studentId !== studentId) return { error: 'Access forbidden', code: 403 };

  if (assignment.status === 'COMPLETED') {
    return { error: 'Assessment is already submitted and completed.', code: 400 };
  }

  // Calculate points and stats up to exit/lockout
  let earnedTotal = 0;
  let possibleTotal = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let totalTime = 0;

  for (const q of assignment.questions) {
    possibleTotal += q.points || 0;
    totalTime += q.timeTakenSeconds || 0;
    if (q.isCorrect) {
      earnedTotal += q.earnedPoints || q.points;
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  const wasAlreadyIncomplete = assignment.status === 'INCOMPLETE' || assignment.status === 'LOCKED_INCOMPLETE';

  assignment.status = 'INCOMPLETE';
  assignment.exitType = exitType;
  assignment.lockedAt = new Date();
  assignment.totalPointsEarned = earnedTotal;
  assignment.correctCount = correctCount;
  assignment.wrongCount = wrongCount;
  assignment.totalTimeTakenSeconds = totalTime;
  assignment.scoreOutOf100 = possibleTotal > 0 ? Math.round((earnedTotal / possibleTotal) * 100) : 0;
  await assignment.save();

  // Update permanent publish history record in MongoDB Atlas
  try {
    if (!wasAlreadyIncomplete) {
      await PublishHistoryModel.updateOne(
        { publishId: assignment.publishedTestId },
        { $inc: { incompleteCount: 1 } }
      );
    }

    await PublishHistoryModel.updateOne(
      { publishId: assignment.publishedTestId, 'studentsStatus.studentId': studentId },
      {
        $set: {
          'studentsStatus.$.status': 'INCOMPLETE',
          'studentsStatus.$.exitType': exitType,
          'studentsStatus.$.scoreOutOf100': assignment.scoreOutOf100,
        },
      }
    );
  } catch (histErr: any) {
    console.error('[History Incomplete Update Error]:', histErr.message);
  }

  return {
    status: 'INCOMPLETE',
    exitType,
    message: reason || `Assessment marked INCOMPLETE (${exitType}).`,
    scoreOutOf100: assignment.scoreOutOf100,
  };
}

// Student Assessment Explicit Exit (Recorded as INCOMPLETE with Exit Type: EXIT)
router.post('/student/tests/:assignmentId/exit', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { assignmentId } = req.params;
    const studentId = req.user!.studentId || req.user!.username;
    const requestedExitType: 'EXIT' | 'LOGOUT' = req.body.exitType === 'LOGOUT' ? 'LOGOUT' : 'EXIT';
    const reason = req.body.reason || (requestedExitType === 'LOGOUT' ? 'Student logged out during assessment' : 'Student explicitly exited assessment');

    const result = await markAssignmentIncomplete(assignmentId, studentId, requestedExitType, reason);
    if ('error' in result) {
      return res.status(result.code || 400).json({ error: result.error });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record assessment exit', details: err.message });
  }
});

// Security Lockout / Violation / Timeout Trigger (also sets status: INCOMPLETE)
router.post('/student/tests/:assignmentId/lock', authenticate, async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user!.studentId || req.user!.username;
    const exitType: 'EXIT' | 'LOGOUT' = req.body.exitType === 'LOGOUT' ? 'LOGOUT' : 'EXIT';
    const reason = req.body.reason || 'Assessment exit or security lock';

    const result = await markAssignmentIncomplete(assignmentId, studentId, exitType, reason);
    if ('error' in result) {
      return res.status(result.code || 400).json({ error: result.error });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to lock assessment', details: err.message });
  }
});

// Student Logout Handler: Automatically marks any IN_PROGRESS test as INCOMPLETE with Exit Type: LOGOUT
router.post('/student/logout', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'student') {
      return res.json({ success: true, message: 'Logged out' });
    }
    const studentId = req.user!.studentId || req.user!.username;

    // Find all IN_PROGRESS assignments for this student
    const inProgressList = await StudentTestAssignmentModel.find({
      studentId,
      status: 'IN_PROGRESS',
    });

    for (const assignment of inProgressList) {
      await markAssignmentIncomplete(
        assignment._id.toString(),
        studentId,
        'LOGOUT',
        'Student logged out during active assessment'
      );
    }

    return res.json({
      success: true,
      markedIncompleteCount: inProgressList.length,
      message: inProgressList.length > 0
        ? `Marked ${inProgressList.length} in-progress assessment(s) as INCOMPLETE (LOGOUT).`
        : 'Logged out successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to handle student logout', details: err.message });
  }
});

// Answer Question & Real-Time Timing / Correctness Evaluation
router.post('/student/tests/:assignmentId/answer', authenticate, async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { questionId, answer, timeTakenSeconds } = req.body;
    const studentId = req.user!.studentId || req.user!.username;

    const assignment = await StudentTestAssignmentModel.findById(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Test not found' });
    if (assignment.studentId !== studentId) return res.status(403).json({ error: 'Access denied' });

    // Block answers if assessment is temporarily paused
    const pubTest = await PublishedTestModel.findById(assignment.publishedTestId);
    if (pubTest?.isPaused || pubTest?.status === 'PAUSED') {
      return res.status(403).json({ error: 'This test is temporarily paused. Please check back later.' });
    }

    if (assignment.status === 'COMPLETED' || assignment.status === 'LOCKED_INCOMPLETE') {
      return res.status(400).json({ error: 'This test is no longer accepting answers' });
    }

    const questionIndex = assignment.questions.findIndex((q: any) => q.questionId === questionId);
    if (questionIndex === -1) return res.status(404).json({ error: 'Question not found in this test' });

    const qItem = assignment.questions[questionIndex];

    // Evaluate answer correctness ONLY if question has a configured correct answer
    const hasCorrectAnswer = qItem.correctAnswer !== undefined && qItem.correctAnswer !== null && String(qItem.correctAnswer).trim() !== '';
    let isCorrect: boolean | undefined = undefined;

    if (hasCorrectAnswer) {
      const expected = qItem.correctAnswer;
      if (answer === undefined || answer === null || String(answer).trim() === '') {
        isCorrect = false;
      } else if (typeof expected === 'string' && typeof answer === 'string') {
        isCorrect = expected.trim().toLowerCase() === answer.trim().toLowerCase();
      } else if (typeof expected === 'number' && !isNaN(Number(answer))) {
        isCorrect = Number(expected) === Number(answer);
      } else {
        isCorrect = JSON.stringify(expected) === JSON.stringify(answer);
      }
    }

    const hasPoints = qItem.points != null && !isNaN(Number(qItem.points)) && Number(qItem.points) > 0;
    const pointsEarned = (hasCorrectAnswer && isCorrect && hasPoints) ? Number(qItem.points) : 0;

    // Use atomic update to prevent Mongoose document version conflicts
    await StudentTestAssignmentModel.findByIdAndUpdate(assignmentId, {
      $set: {
        [`questions.${questionIndex}.studentAnswer`]: answer,
        [`questions.${questionIndex}.isCorrect`]: hasCorrectAnswer ? (isCorrect ?? false) : false,
        [`questions.${questionIndex}.timeTakenSeconds`]: Math.max(0, Number(timeTakenSeconds) || 0),
        [`questions.${questionIndex}.earnedPoints`]: pointsEarned,
      },
    });

    return res.json({
      success: true,
      questionId,
      timeTakenSeconds,
      isCorrect,
      earnedPoints: pointsEarned,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save question answer', details: err.message });
  }
});

// Final Test Submission
router.post('/student/tests/:assignmentId/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user!.studentId || req.user!.username;

    const assignment = await StudentTestAssignmentModel.findById(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Test not found' });
    if (assignment.studentId !== studentId) return res.status(403).json({ error: 'Access denied' });

    // Block submit if assessment is temporarily paused
    const pubTest = await PublishedTestModel.findById(assignment.publishedTestId);
    if (pubTest?.isPaused || pubTest?.status === 'PAUSED') {
      return res.status(403).json({ error: 'This test is temporarily paused. Please check back later.' });
    }

    if (assignment.status === 'COMPLETED') {
      return res.json({
        status: 'COMPLETED',
        message: 'This test is already submitted.',
        scoreOutOf100: assignment.scoreOutOf100,
        totalPointsEarned: assignment.totalPointsEarned,
      });
    }

    if (assignment.status === 'LOCKED_INCOMPLETE') {
      return res.status(400).json({ error: 'This test has ended and can no longer be submitted.' });
    }

    // Process answers payload if sent from frontend
    const { answers } = req.body;
    if (answers && Array.isArray(answers)) {
      for (const ansItem of answers) {
        const qIdx = assignment.questions.findIndex((q: any) => q.questionId === ansItem.questionId);
        if (qIdx !== -1) {
          const qItem = assignment.questions[qIdx];
          const hasCorrectAnswer = qItem.correctAnswer !== undefined && qItem.correctAnswer !== null && String(qItem.correctAnswer).trim() !== '';
          let isCorrect: boolean | undefined = undefined;

          if (hasCorrectAnswer) {
            const expected = qItem.correctAnswer;
            const stuAns = ansItem.answer;
            if (stuAns === undefined || stuAns === null || String(stuAns).trim() === '') {
              isCorrect = false;
            } else if (typeof expected === 'string' && typeof stuAns === 'string') {
              isCorrect = expected.trim().toLowerCase() === stuAns.trim().toLowerCase();
            } else if (typeof expected === 'number' && !isNaN(Number(stuAns))) {
              isCorrect = Number(expected) === Number(stuAns);
            } else {
              isCorrect = JSON.stringify(expected) === JSON.stringify(stuAns);
            }
          }

          const hasPoints = qItem.points != null && !isNaN(Number(qItem.points)) && Number(qItem.points) > 0;
          const pointsEarned = (hasCorrectAnswer && isCorrect && hasPoints) ? Number(qItem.points) : 0;

          assignment.questions[qIdx].studentAnswer = ansItem.answer;
          assignment.questions[qIdx].isCorrect = hasCorrectAnswer ? (isCorrect ?? false) : false;
          assignment.questions[qIdx].timeTakenSeconds = Math.max(0, Number(ansItem.timeTakenSeconds) || 0);
          assignment.questions[qIdx].earnedPoints = pointsEarned;
        }
      }
    }

    // Finalize score computations
    let earnedPointsTotal = 0;
    let possiblePointsTotal = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let totalTime = 0;

    for (const q of assignment.questions) {
      const hasPoints = q.points != null && !isNaN(Number(q.points)) && Number(q.points) > 0;
      if (hasPoints) {
        possiblePointsTotal += Number(q.points);
      }
      totalTime += Math.max(0, Number(q.timeTakenSeconds) || 0);

      const hasCorrectAnswer = q.correctAnswer !== undefined && q.correctAnswer !== null && String(q.correctAnswer).trim() !== '';
      if (hasCorrectAnswer) {
        if (q.isCorrect) {
          earnedPointsTotal += (q.earnedPoints != null && !isNaN(Number(q.earnedPoints)) ? Number(q.earnedPoints) : (hasPoints ? Number(q.points) : 0));
          correctCount++;
        } else {
          wrongCount++;
        }
      }
      // If question has no correct answer, do not attempt automatic evaluation or increment counts
    }

    const calculatedScore = possiblePointsTotal > 0 ? Math.round((earnedPointsTotal / possiblePointsTotal) * 100) : 0;
    const finalScore = Number.isFinite(calculatedScore) ? calculatedScore : 0;

    const completedAt = new Date();
    // Atomic direct update in MongoDB Atlas to avoid Mongoose VersionError and parallel save issues
    await StudentTestAssignmentModel.findByIdAndUpdate(assignmentId, {
      $set: {
        questions: assignment.questions,
        status: 'COMPLETED',
        completedAt,
        totalPointsEarned: earnedPointsTotal,
        correctCount,
        wrongCount,
        totalTimeTakenSeconds: totalTime,
        scoreOutOf100: finalScore,
      },
    });

    // Update publish history in Atlas
    try {
      const publishHistory = await PublishHistoryModel.findOne({ publishId: assignment.publishedTestId });
      if (publishHistory) {
        const currentIncomplete = Number(publishHistory.incompleteCount) || 0;
        const decIncomplete = currentIncomplete > 0 ? -1 : 0;

        await PublishHistoryModel.updateOne(
          { publishId: assignment.publishedTestId },
          {
            $inc: {
              completedCount: 1,
              ...(decIncomplete !== 0 ? { incompleteCount: decIncomplete } : {}),
            },
          }
        );
        await PublishHistoryModel.updateOne(
          { publishId: assignment.publishedTestId, 'studentsStatus.studentId': studentId },
          {
            $set: {
              'studentsStatus.$.status': 'COMPLETED',
              'studentsStatus.$.completionDate': new Date().toISOString().split('T')[0],
              'studentsStatus.$.completionTime': new Date().toLocaleTimeString(),
              'studentsStatus.$.scoreOutOf100': finalScore,
            },
          }
        );
      }
    } catch (historyErr: any) {
      console.error('[Submit] Warning: Failed to update publish history record:', historyErr.message);
      // Non-blocking: student assignment is already safely completed in MongoDB Atlas
    }

    return res.json({
      status: 'COMPLETED',
      scoreOutOf100: finalScore,
      totalPointsEarned: earnedPointsTotal,
      correctCount,
      wrongCount,
      totalTimeTakenSeconds: totalTime,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Unable to submit test. Please try again.', details: err.message });
  }
});

// ==========================================
// 7. PUBLISH HISTORY & DRILL-DOWN
// ==========================================

// Get All Publish History
router.get('/publish-history', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const history = await PublishHistoryModel.find({}, { questionsSnapshot: 0, studentsStatus: 0 }).sort({ updatedAt: -1, publishedAt: -1, createdAt: -1 });

    const publishIds = history.map((h) => h.publishId).filter(Boolean);
    const pubTests = await PublishedTestModel.find(
      { _id: { $in: publishIds } },
      { startDate: 1, startTime: 1, endDate: 1, endTime: 1, createdAt: 1, publishedAt: 1, updatedAt: 1, status: 1, isPaused: 1, shuffle: 1 }
    ).lean();
    const pubTestMap = new Map<string, any>(pubTests.map((pt: any) => [pt._id.toString(), pt]));

    // Aggregation of actual assigned student counts per school per publishedTestId (filtered to active published tests)
    const schoolCountsAgg = publishIds.length > 0 ? await StudentTestAssignmentModel.aggregate([
      {
        $match: { publishedTestId: { $in: publishIds } },
      },
      {
        $group: {
          _id: { publishedTestId: '$publishedTestId', schoolName: '$schoolName', schoolId: '$schoolId' },
          count: { $sum: 1 },
        },
      },
    ]) : [];

    const schoolCountsMap = new Map<string, Array<{ schoolName: string; schoolId?: string; count: number }>>();
    for (const item of schoolCountsAgg) {
      const pId = item._id.publishedTestId;
      const sName = item._id.schoolName || 'Unknown School';
      if (!schoolCountsMap.has(pId)) {
        schoolCountsMap.set(pId, []);
      }
      schoolCountsMap.get(pId)!.push({ schoolName: sName, schoolId: item._id.schoolId, count: item.count });
    }

    const formatted = formatDocs(history).map((h: any) => {
      let schoolCounts = schoolCountsMap.get(h.publishId) || [];
      // Fallback if no live assignments exist (e.g. legacy publish records)
      if (schoolCounts.length === 0) {
        if (Array.isArray(h.studentsStatus) && h.studentsStatus.length > 0) {
          const sMap = new Map<string, number>();
          for (const st of h.studentsStatus) {
            const name = st.schoolName || h.schoolName || 'School';
            sMap.set(name, (sMap.get(name) || 0) + 1);
          }
          schoolCounts = Array.from(sMap.entries()).map(([schoolName, count]) => ({ schoolName, count }));
        } else if (h.schoolNames && h.schoolNames.length > 0) {
          schoolCounts = h.schoolNames.map((name: string) => ({
            schoolName: name,
            count: Math.round((h.totalRecipients || 0) / h.schoolNames.length) || 1,
          }));
        } else if (h.schoolName) {
          schoolCounts = [{ schoolName: h.schoolName, count: h.totalRecipients || 0 }];
        }
      }

      const pub = pubTestMap.get(h.publishId);
      const effectivePublishTime = h.publishedAt || h.updatedAt || h.createdAt || pub?.publishedAt || pub?.updatedAt || pub?.createdAt;
      return {
        ...h,
        shuffle: Boolean(pub?.shuffle ?? h.shuffle),
        schoolCounts,
        startDate: h.startDate || pub?.startDate || h.date,
        startTime: h.startTime || pub?.startTime || h.time,
        endDate: h.endDate || pub?.endDate || '',
        endTime: h.endTime || pub?.endTime || '',
        publishedAt: effectivePublishTime,
        updatedAt: h.updatedAt || pub?.updatedAt || effectivePublishTime,
        createdAt: effectivePublishTime,
        status: h.status || pub?.status || 'ACTIVE',
        isPaused: h.isPaused ?? pub?.isPaused ?? false,
      };
    });

    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch publish history', details: err.message });
  }
});

// Get Specific Publish History Record with Who Completed & Who Did Not Complete
router.get('/publish-history/:publishId', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { publishId } = req.params;
    const historyDoc = await PublishHistoryModel.findOne({ publishId });
    if (!historyDoc) return res.status(404).json({ error: 'Publish history record not found' });

    const pubTest = await PublishedTestModel.findById(publishId).lean();

    // Fetch live assignments from MongoDB collection studenttestassignments
    const liveAssignments = await StudentTestAssignmentModel.find({ publishedTestId: publishId });
    const assignMap = new Map<string, any>();
    for (const a of liveAssignments) {
      assignMap.set(a.studentId, a);
    }

    const history = formatDoc(historyDoc);

    const processedStudentIds = new Set<string>();
    const studentsStatus: any[] = (history.studentsStatus || []).map((s: any) => {
      const sId = s.studentId || s.uniqueStudentId;
      processedStudentIds.add(sId);
      const live = assignMap.get(sId);
      const effectiveStatus = live ? live.status : s.status;
      const effectiveExitType = (effectiveStatus === 'COMPLETED' || effectiveStatus === 'NOT_STARTED')
        ? null
        : (live && (live.exitType === 'EXIT' || live.exitType === 'LOGOUT')
          ? live.exitType
          : (s.exitType === 'EXIT' || s.exitType === 'LOGOUT' ? s.exitType : null));
      const effectiveScore = live ? live.scoreOutOf100 : s.scoreOutOf100;
      return {
        ...s,
        studentName: s.studentName || live?.studentName || 'Student',
        schoolId: live?.schoolId || s.schoolId || history.schoolId || '',
        schoolName: live?.schoolName || s.schoolName || history.schoolName || '',
        className: live?.className || s.className || '',
        section: live?.section || s.section || '',
        assessmentName: history.publishName,
        status: effectiveStatus,
        exitType: effectiveExitType || null,
        scoreOutOf100: effectiveScore != null ? effectiveScore : 0,
      };
    });

    for (const [stId, live] of assignMap.entries()) {
      if (!processedStudentIds.has(stId)) {
        studentsStatus.push({
          studentId: stId,
          uniqueStudentId: stId,
          studentName: live.studentName || 'Student',
          schoolId: live.schoolId || history.schoolId || '',
          schoolName: live.schoolName || history.schoolName || '',
          className: live.className || '',
          section: live.section || '',
          assessmentName: history.publishName,
          status: live.status,
          exitType: (live.status === 'COMPLETED' || live.status === 'NOT_STARTED')
            ? null
            : (live.exitType === 'EXIT' || live.exitType === 'LOGOUT' ? live.exitType : null),
          scoreOutOf100: live.scoreOutOf100 != null ? live.scoreOutOf100 : 0,
        });
      }
    }

    // Resolve targets configuration: check historyDoc.targets, historyDoc.target, or PublishedTestModel.targets
    let rawTargets: any[] = [];
    if (Array.isArray(history.targets) && history.targets.length > 0) {
      rawTargets = history.targets;
    } else {
      if (pubTest && Array.isArray(pubTest.targets) && pubTest.targets.length > 0) {
        rawTargets = pubTest.targets;
      } else if (history.target) {
        rawTargets = [history.target];
      } else if (pubTest?.target) {
        rawTargets = [pubTest.target];
      } else {
        rawTargets = [
          {
            schoolNames: history.schoolNames || (history.schoolName ? [history.schoolName] : []),
            schoolIds: history.schoolIds || (history.schoolId ? [history.schoolId] : []),
            classes: history.classes || ['All Classes'],
            sections: history.sections || [],
          },
        ];
      }
    }

    // For each target, compute the exact assigned student count from studentsStatus
    const allSchoolsList = await SchoolModel.find({}, { _id: 1, name: 1 });
    const totalSchoolsCount = allSchoolsList.length;

    const resolvedTargets = rawTargets.map((t: any, idx: number) => {
      // Determine if target covers All Schools
      const isAllSchools =
        t.isAllSchools === true ||
        (Array.isArray(t.schoolIds) && (t.schoolIds.includes('ALL') || (totalSchoolsCount > 1 && t.schoolIds.length >= totalSchoolsCount))) ||
        (Array.isArray(t.schoolNames) && t.schoolNames.includes('All Schools'));

      // Count students matching this specific target configuration
      const matchingCount = studentsStatus.filter((st: any) => {
        const matchSchool =
          isAllSchools ||
          !t.schoolIds ||
          t.schoolIds.length === 0 ||
          t.schoolIds.includes(st.schoolId) ||
          (Array.isArray(t.schoolNames) && t.schoolNames.includes(st.schoolName));

        const matchClass =
          !t.classes ||
          t.classes.length === 0 ||
          t.classes.includes('ALL') ||
          t.classes.includes('All Classes') ||
          t.classes.some((c: string) => c.toLowerCase() === (st.className || '').toLowerCase());

        const matchSection =
          !t.sections ||
          t.sections.length === 0 ||
          t.sections.includes('ALL') ||
          t.sections.includes('All Sections') ||
          t.sections.some((sec: string) => sec.toUpperCase() === (st.section || '').toUpperCase());

        const matchStudent =
          !t.studentIds ||
          t.studentIds.length === 0 ||
          t.studentIds.includes('ALL') ||
          t.studentIds.includes(st.studentId) ||
          t.studentIds.includes(st.uniqueStudentId);

        return matchSchool && matchClass && matchSection && matchStudent;
      }).length;

      return {
        ...t,
        targetNumber: idx + 1,
        isAllSchools,
        assignedCount: matchingCount > 0 ? matchingCount : (t.assignedCount != null ? t.assignedCount : 0),
      };
    });

    const completedStudents = studentsStatus.filter((s: any) => s.status === 'COMPLETED');
    const notCompletedStudents = studentsStatus.filter((s: any) => s.status !== 'COMPLETED');

    // Extract historical questions snapshot from historyDoc / pubTest questionsSnapshot (preserves full eligible pool)
    const questionMap = new Map<string, any>();

    const storedSnapshot =
      Array.isArray(history.questionsSnapshot) && history.questionsSnapshot.length > 0
        ? history.questionsSnapshot
        : Array.isArray(pubTest?.questionsSnapshot) && pubTest.questionsSnapshot.length > 0
        ? pubTest.questionsSnapshot
        : [];

    for (const q of storedSnapshot) {
      const qId = q.questionId || q.id || q._id;
      if (qId && !questionMap.has(String(qId))) {
        questionMap.set(String(qId), {
          id: String(qId),
          questionId: String(qId),
          groupName: (q.groupName || 'General').trim(),
          difficulty: (q.difficulty || 'Medium').trim(),
          content: q.content || 'Question',
          points: q.points != null ? Number(q.points) : null,
          timeAllowedSeconds:
            q.timeAllowedSeconds != null
              ? Number(q.timeAllowedSeconds)
              : q.timeSeconds != null
              ? Number(q.timeSeconds)
              : null,
          timeSeconds:
            q.timeAllowedSeconds != null
              ? Number(q.timeAllowedSeconds)
              : q.timeSeconds != null
              ? Number(q.timeSeconds)
              : null,
          options: q.options || [],
          metadata: q.metadata || {},
          pairs: q.pairs || q.metadata?.pairs || [],
        });
      }
    }

    const targetQIds =
      Array.isArray(history.questionIds) && history.questionIds.length > 0
        ? history.questionIds
        : Array.isArray(pubTest?.questionIds) && pubTest.questionIds.length > 0
        ? pubTest.questionIds
        : [];

    if (questionMap.size === 0 && targetQIds.length > 0) {
      const qDocs = await QuestionModel.find({ _id: { $in: targetQIds } });
      for (const q of qDocs) {
        const qId = q._id.toString();
        if (!questionMap.has(qId)) {
          questionMap.set(qId, {
            id: qId,
            questionId: qId,
            groupName: (q.groupName || 'General').trim(),
            difficulty: (q.difficulty || 'Medium').trim(),
            content: q.content,
            points: q.points != null ? Number(q.points) : null,
            timeAllowedSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
            timeSeconds: q.timeSeconds != null ? Number(q.timeSeconds) : null,
            options: q.options || [],
            metadata: q.metadata || {},
            pairs: q.metadata?.pairs || [],
          });
        }
      }
    }

    if (questionMap.size === 0) {
      for (const a of liveAssignments) {
        if (Array.isArray(a.questions)) {
          for (const q of a.questions) {
            const qId = q.questionId || q.id || q._id;
            if (qId && !questionMap.has(String(qId))) {
              questionMap.set(String(qId), {
                id: String(qId),
                questionId: String(qId),
                groupName: (q.groupName || 'General').trim(),
                difficulty: (q.difficulty || 'Medium').trim(),
                content: q.content || 'Question',
                points: q.points != null ? Number(q.points) : null,
                timeAllowedSeconds:
                  q.timeAllowedSeconds != null
                    ? Number(q.timeAllowedSeconds)
                    : q.timeSeconds != null
                    ? Number(q.timeSeconds)
                    : null,
                timeSeconds:
                  q.timeAllowedSeconds != null
                    ? Number(q.timeAllowedSeconds)
                    : q.timeSeconds != null
                    ? Number(q.timeSeconds)
                    : null,
                options: q.options || [],
                metadata: q.metadata || {},
                pairs: q.pairs || q.metadata?.pairs || [],
              });
            }
          }
        }
      }
    }

    const historicalQuestions = Array.from(questionMap.values());

    // Build question summary breakdown: Group -> Difficulty -> count
    const questionSummaryMap = new Map<string, Map<string, number>>();
    for (const q of historicalQuestions) {
      const g = q.groupName || 'General';
      const d = q.difficulty || 'Medium';
      if (!questionSummaryMap.has(g)) {
        questionSummaryMap.set(g, new Map());
      }
      const diffMap = questionSummaryMap.get(g)!;
      diffMap.set(d, (diffMap.get(d) || 0) + 1);
    }

    const questionSummary: Array<{
      groupName: string;
      difficulties: Array<{ difficulty: string; count: number }>;
    }> = [];

    for (const [g, diffMap] of questionSummaryMap.entries()) {
      const standardOrder = ['Easy', 'Medium', 'Hard'];
      const diffKeys = Array.from(diffMap.keys());
      const sortedKeys = [
        ...standardOrder.filter((d) => diffKeys.includes(d)),
        ...diffKeys.filter((d) => !standardOrder.includes(d)),
      ];
      questionSummary.push({
        groupName: g,
        difficulties: sortedKeys.map((d) => ({
          difficulty: d,
          count: diffMap.get(d) || 0,
        })),
      });
    }

    // School counts summary
    const schoolCountsMap = new Map<string, number>();
    for (const st of studentsStatus) {
      const sName = st.schoolName || history.schoolName || 'School';
      schoolCountsMap.set(sName, (schoolCountsMap.get(sName) || 0) + 1);
    }
    const schoolCounts = Array.from(schoolCountsMap.entries()).map(([schoolName, count]) => ({ schoolName, count }));

    const effectivePublishTime = history.publishedAt || history.updatedAt || history.createdAt || pubTest?.publishedAt || pubTest?.updatedAt || pubTest?.createdAt;
    return res.json({
      ...history,
      shuffle: Boolean(pubTest?.shuffle ?? history.shuffle),
      startDate: history.startDate || pubTest?.startDate || history.date,
      startTime: history.startTime || pubTest?.startTime || history.time,
      endDate: history.endDate || pubTest?.endDate || '',
      endTime: history.endTime || pubTest?.endTime || '',
      publishedAt: effectivePublishTime,
      updatedAt: history.updatedAt || pubTest?.updatedAt || effectivePublishTime,
      createdAt: effectivePublishTime,
      status: history.status || pubTest?.status || 'ACTIVE',
      isPaused: history.isPaused ?? pubTest?.isPaused ?? false,
      targets: resolvedTargets,
      schoolCounts,
      studentsStatus,
      completedStudents,
      notCompletedStudents,
      questions: historicalQuestions,
      questionSummary,
      totalQuestionsCount: historicalQuestions.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch publish history detail', details: err.message });
  }
});

// Pause an Assessment (Super Admin Only)
router.post('/publish-history/:publishId/pause', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { publishId } = req.params;
    const pubTest = await PublishedTestModel.findById(publishId);
    const history = await PublishHistoryModel.findOne({ publishId });

    if (!pubTest && !history) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (pubTest) {
      pubTest.status = 'PAUSED';
      pubTest.isPaused = true;
      await pubTest.save();
    }
    if (history) {
      history.status = 'PAUSED';
      history.isPaused = true;
      await history.save();
    }

    return res.json({
      success: true,
      status: 'PAUSED',
      isPaused: true,
      message: `Assessment '${history?.publishName || pubTest?.publishName || publishId}' is now temporarily paused.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to pause assessment', details: err.message });
  }
});

// Resume an Assessment (Super Admin Only)
router.post('/publish-history/:publishId/resume', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { publishId } = req.params;
    const pubTest = await PublishedTestModel.findById(publishId);
    const history = await PublishHistoryModel.findOne({ publishId });

    if (!pubTest && !history) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (pubTest) {
      pubTest.status = 'ACTIVE';
      pubTest.isPaused = false;
      await pubTest.save();
    }
    if (history) {
      history.status = 'ACTIVE';
      history.isPaused = false;
      await history.save();
    }

    return res.json({
      success: true,
      status: 'ACTIVE',
      isPaused: false,
      message: `Assessment '${history?.publishName || pubTest?.publishName || publishId}' has been resumed.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to resume assessment', details: err.message });
  }
});

// Delete an Assessment (Super Admin Only)
const handleDeletePublishedAssessment = async (req: Request, res: Response) => {
  try {
    const { publishId } = req.params;
    const pubTest = await PublishedTestModel.findById(publishId);
    const history = await PublishHistoryModel.findOne({ publishId });

    if (!pubTest && !history) {
      return res.status(404).json({ error: 'Published assessment not found for deletion' });
    }

    const assessmentName = history?.publishName || pubTest?.publishName || publishId;

    // Delete associated student assignments strictly for this published test only
    const deletedAssignments = await StudentTestAssignmentModel.deleteMany({ publishedTestId: publishId });

    // Delete publish history record
    await PublishHistoryModel.deleteOne({ publishId });

    // Delete published test record
    await PublishedTestModel.deleteOne({ _id: publishId });

    return res.json({
      success: true,
      message: `Assessment '${assessmentName}' and all associated student assignments deleted successfully.`,
      deletedAssignmentsCount: deletedAssignments.deletedCount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete assessment', details: err.message });
  }
};

router.delete('/publish-history/:publishId', authenticate, requireRole('super_admin'), handleDeletePublishedAssessment);
router.delete('/published-tests/:publishId', authenticate, requireRole('super_admin'), handleDeletePublishedAssessment);

// ==========================================
// 8. REPORTS & STUDENT TEST TIMELINE
// ==========================================

// Get unique classes for a school from actual student records in MongoDB Atlas
router.get('/reports/schools/:schoolId/classes', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const rawClasses = await UserModel.distinct('className', {
      role: 'student',
      schoolId,
    });

    const cleanClasses = Array.from(
      new Set(
        rawClasses
          .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
          .map((c: string) => c.trim())
      )
    ).sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return res.json({ classes: cleanClasses });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch classes for school', details: err.message });
  }
});

// Helper to escape regex special characters
const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get unique sections for a school and class from actual student records in MongoDB Atlas
router.get('/reports/schools/:schoolId/sections', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { className } = req.query as { className?: string };

    const query: any = {
      role: 'student',
      schoolId,
    };

    if (className && className.trim()) {
      query.className = { $regex: new RegExp(`^${escapeRegExp(className.trim())}$`, 'i') };
    }

    const rawSections = await UserModel.distinct('section', query);

    const cleanSections = Array.from(
      new Set(
        rawSections
          .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim().toUpperCase())
      )
    ).sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return res.json({ sections: cleanSections });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch sections for school and class', details: err.message });
  }
});

// Super Admin Student Reports List (School -> Class -> Section -> Search)
router.get('/reports/schools/:schoolId/students', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { className, section, search } = req.query as { className?: string; section?: string; search?: string };

    const query: any = { role: 'student', schoolId };

    if (className && className.trim()) {
      query.className = { $regex: new RegExp(`^${escapeRegExp(className.trim())}$`, 'i') };
    }
    if (section && section.trim()) {
      query.section = { $regex: new RegExp(`^${escapeRegExp(section.trim())}$`, 'i') };
    }
    if (search && search.trim()) {
      const escapedQ = escapeRegExp(search.trim());
      query.$or = [
        { studentName: { $regex: escapedQ, $options: 'i' } },
        { schoolAdmissionNumber: { $regex: escapedQ, $options: 'i' } },
        { uniqueStudentId: { $regex: escapedQ, $options: 'i' } },
        { username: { $regex: escapedQ, $options: 'i' } },
      ];
    }

    const students = await UserModel.find(query);
    const sorted = formatDocs(students).sort((a: any, b: any) =>
      (a.studentName || '').localeCompare(b.studentName || '', undefined, { numeric: true, sensitivity: 'base' })
    );
    return res.json(sorted);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch student reports list', details: err.message });
  }
});

// Helper to format date and time as DD-MM-YYYY | hh:mm A
function formatAssessmentDateTime(dateVal?: Date | string | null): string {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = pad(hours);
  return `${day}-${month}-${year} | ${hoursStr}:${minutes} ${ampm}`;
}

// Student Individual Report & Timeline
router.get('/reports/students/:studentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;

    // Student can only access their own report
    if (req.user!.role === 'student' && req.user!.studentId !== studentId && req.user!.username !== studentId) {
      return res.status(403).json({ error: 'Access forbidden: You can only view your own report' });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(studentId);
    const student = await UserModel.findOne({
      $or: [
        { uniqueStudentId: studentId },
        { username: studentId },
        ...(isMongoId ? [{ _id: studentId }] : []),
      ],
    });

    const targetStudentId = student?.uniqueStudentId || studentId;
    const assignments = await StudentTestAssignmentModel.find({
      $or: [
        { studentId: targetStudentId },
        { studentId },
      ],
    });

    // Sort assignments chronologically (oldest attempt first = Assessment - 1, then Assessment - 2, etc.)
    const sortedAssignments = [...assignments].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.startedAt || a.completedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.startedAt || b.completedAt || 0).getTime();
      return timeA - timeB;
    });

    // Fetch published tests and publish histories to get exact assessment name, mode, and published timestamp
    const publishIds = Array.from(new Set(sortedAssignments.map((a) => a.publishedTestId).filter(Boolean)));
    const publishedTests = await PublishedTestModel.find({ _id: { $in: publishIds } }).lean();
    const pubMap = new Map<string, any>(publishedTests.map((pt: any) => [pt._id.toString(), pt]));
    const publishHistories = await PublishHistoryModel.find({ publishId: { $in: publishIds } }).lean();
    const histMap = new Map<string, any>(publishHistories.map((ph: any) => [ph.publishId, ph]));

    // Fetch only needed questions and groups for this student's attempts
    const neededQuestionIds = Array.from(
      new Set(
        sortedAssignments.flatMap((a) => (a.questions || []).map((q: any) => q.questionId).filter(Boolean))
      )
    );
    const relevantQuestions = neededQuestionIds.length > 0
      ? await QuestionModel.find({ _id: { $in: neededQuestionIds } }).lean()
      : [];
    const qMap = new Map<string, any>(relevantQuestions.map((q: any) => [q._id.toString(), q]));

    const neededGroupIds = Array.from(
      new Set(
        [
          ...relevantQuestions.map((q: any) => q.groupId),
          ...sortedAssignments.flatMap((a) => (a.questions || []).map((q: any) => q.groupId)),
        ].filter(Boolean)
      )
    );
    const relevantGroups = neededGroupIds.length > 0
      ? await QuestionGroupModel.find({ _id: { $in: neededGroupIds } }).lean()
      : [];
    const gMap = new Map<string, any>(relevantGroups.map((g: any) => [g._id.toString(), g]));

    // Timeline entries
    const timeline = sortedAssignments.map((a, idx) => {
      const assessmentNumber = idx + 1;
      const assessmentTitle = `Assessment - ${assessmentNumber}`;
      const effectiveDateObj =
        a.status === 'COMPLETED'
          ? a.completedAt || a.updatedAt || a.startedAt || a.createdAt
          : a.lockedAt || a.startedAt || a.updatedAt || a.createdAt;

      const formattedDate = formatAssessmentDateTime(effectiveDateObj);

      const pubTest = pubMap.get(a.publishedTestId);
      const hist = histMap.get(a.publishedTestId);
      const assessmentName = pubTest?.publishName || hist?.publishName || a.publishName || assessmentTitle;
      const publishMode = pubTest?.publishMode || hist?.publishMode || 'Selected Questions';
      const publishedCreatedAt = pubTest?.createdAt || hist?.createdAt || pubTest?.publishedAt || hist?.publishedAt || a.createdAt;

      return {
        assignmentId: a._id.toString(),
        publishedTestId: a.publishedTestId,
        assessmentNumber,
        assessmentTitle,
        testName: assessmentTitle,
        assessmentName,
        publishName: assessmentName,
        publishMode,
        publishedCreatedAt: publishedCreatedAt ? new Date(publishedCreatedAt).toISOString() : null,
        originalPublishName: a.publishName,
        status: a.status,
        exitType: (a.status === 'COMPLETED' || a.status === 'NOT_STARTED') ? null : (a.exitType === 'EXIT' || a.exitType === 'LOGOUT' ? a.exitType : null),
        completedAt: a.completedAt,
        startedAt: a.startedAt,
        lockedAt: a.lockedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        date: formattedDate,
        formattedDateTime: formattedDate,
        scoreOutOf100: a.scoreOutOf100,
        totalPointsEarned: a.totalPointsEarned,
        correctCount: a.correctCount,
        wrongCount: a.wrongCount,
        totalTimeTakenSeconds: a.totalTimeTakenSeconds,
        questions: (a.questions || []).map((q: any) => {
          const fullQ = q.questionId ? qMap.get(String(q.questionId)) : null;
          const groupFromId = q.groupId ? gMap.get(String(q.groupId))?.name : (fullQ?.groupId ? gMap.get(String(fullQ.groupId))?.name : null);
          return {
            ...q,
            groupName: q.groupName || groupFromId || fullQ?.groupName || 'General',
            difficulty: q.difficulty || fullQ?.difficulty || 'Medium',
            content: q.content || fullQ?.content || 'Question',
            points: q.points != null ? q.points : (fullQ?.points != null ? fullQ.points : null),
            timeAllowedSeconds: q.timeAllowedSeconds != null ? q.timeAllowedSeconds : (fullQ?.timeSeconds != null ? fullQ.timeSeconds : null),
            options: q.options || fullQ?.options || [],
          };
        }),
      };
    });

    return res.json({
      student: student ? {
        id: student._id.toString(),
        studentName: student.studentName,
        className: student.className,
        section: student.section,
        schoolAdmissionNumber: student.schoolAdmissionNumber,
        uniqueStudentId: student.uniqueStudentId,
        schoolName: student.schoolName,
      } : (sortedAssignments.length > 0 ? {
        id: targetStudentId,
        studentName: sortedAssignments[0].studentName || targetStudentId,
        className: sortedAssignments[0].className || '',
        section: sortedAssignments[0].section || '',
        schoolAdmissionNumber: targetStudentId,
        uniqueStudentId: targetStudentId,
        schoolName: sortedAssignments[0].schoolName || '',
      } : null),
      timeline,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch student timeline report', details: err.message });
  }
});

// ==========================================
// 12. ASSESSMENT TEMPLATES
// ==========================================

// List all templates
router.get('/templates', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const templates = await AssessmentTemplateModel.find().sort({ createdAt: -1 });
    return res.json(formatDocs(templates));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch templates', details: err.message });
  }
});

// Create a new template
router.post('/templates', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const {
      name,
      publishMode,
      selectedQuestionIds = [],
      randomSelectedDifficulties = [],
      shuffleQuestions = false,
      randomCount = 5,
      targets = [],
    } = req.body;

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Template Name is required.' });
    }

    // Check duplicate template name (case-insensitive)
    const existing = await AssessmentTemplateModel.findOne({
      name: { $regex: new RegExp(`^${escapeRegExp(trimmedName)}$`, 'i') },
    });

    if (existing) {
      return res.status(400).json({
        error: `A template named '${trimmedName}' already exists. Please choose a different unique name.`,
      });
    }

    if (!publishMode || !['Selected Questions', 'Random Questions'].includes(publishMode)) {
      return res.status(400).json({ error: 'Valid Publish Mode is required.' });
    }

    if (publishMode === 'Selected Questions' && (!selectedQuestionIds || selectedQuestionIds.length === 0)) {
      return res.status(400).json({ error: 'Please select at least 1 question before saving the template.' });
    }

    if (publishMode === 'Random Questions') {
      if ((!selectedQuestionIds || selectedQuestionIds.length === 0) && (!randomSelectedDifficulties || randomSelectedDifficulties.length === 0)) {
        return res.status(400).json({ error: 'Please select at least 1 Group and Difficulty for Random Questions mode.' });
      }
    }

    const cleanTargets = Array.isArray(targets)
      ? targets.map((t: any, idx: number) => ({
          id: t.id || `target-${Date.now()}-${idx}`,
          selectedSchoolIds: Array.isArray(t.selectedSchoolIds) ? t.selectedSchoolIds : ['ALL'],
          selectedClasses: Array.isArray(t.selectedClasses) ? t.selectedClasses : ['ALL'],
          selectedSections: Array.isArray(t.selectedSections) ? t.selectedSections : [],
          selectedStudentIds: Array.isArray(t.selectedStudentIds) ? t.selectedStudentIds : [],
        }))
      : [];

    const newTemplate = await AssessmentTemplateModel.create({
      name: trimmedName,
      publishMode,
      selectedQuestionIds: Array.isArray(selectedQuestionIds) ? selectedQuestionIds : [],
      randomSelectedDifficulties: Array.isArray(randomSelectedDifficulties) ? randomSelectedDifficulties : [],
      shuffleQuestions: Boolean(shuffleQuestions),
      randomCount: Number(randomCount) || 5,
      targets: cleanTargets,
      createdBy: req.user?.username || 'san',
    });

    return res.status(201).json({
      message: `Template '${trimmedName}' saved successfully.`,
      template: formatDoc(newTemplate),
    });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(400).json({
        error: 'A template with this name already exists. Please choose a unique name.',
      });
    }
    return res.status(500).json({ error: 'Failed to save template', details: err.message });
  }
});

// Delete a template
router.delete('/templates/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await AssessmentTemplateModel.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await AssessmentTemplateModel.findOneAndDelete({
        $or: [{ _id: id }, { name: id }].filter(Boolean),
      });
    }
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.json({ message: 'Template deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete template', details: err.message });
  }
});

export default router;
