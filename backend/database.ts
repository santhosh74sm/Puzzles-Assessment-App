import mongoose from 'mongoose';
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
import bcrypt from 'bcryptjs';

export async function connectMongoDB(): Promise<{ isConnected: boolean; dbName: string }> {
  try {
    const rawUri = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();

    if (!rawUri) {
      throw new Error(
        'Neither MONGO_URI nor MONGODB_URI environment variable is configured.'
      );
    }

    // Enforce target database puzzles_assessment_dev
    let finalUri = rawUri;
    if (!finalUri.includes('/puzzles_assessment_dev')) {
      if (finalUri.includes('/?')) {
        finalUri = finalUri.replace('/?', '/puzzles_assessment_dev?');
      } else if (finalUri.endsWith('/')) {
        finalUri = finalUri + 'puzzles_assessment_dev';
      } else if (!finalUri.split('?')[0].split('/').pop()) {
        finalUri = finalUri + '/puzzles_assessment_dev';
      }
    }

    console.log('[Database] Connecting to configured MongoDB deployment (target database: puzzles_assessment_dev).');

    await mongoose.connect(finalUri, {
      dbName: 'puzzles_assessment_dev',
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    console.log(`[Database] Successfully connected to dedicated database: ${mongoose.connection.name}`);

    // Ensure required collection and schema structures exist in puzzles_assessment_dev without inserting sample data
    await ensureCollectionStructures();

    // Ensure initial Super Admin ('san' / 'san' with mustChangePassword: true) in Atlas if not existing
    await ensureInitialSuperAdmin();

    return { isConnected: true, dbName: mongoose.connection.name };
  } catch (err: any) {
    const errorName = typeof err?.name === 'string' ? err.name : 'UnknownError';
    const errorCode = typeof err?.code === 'string' || typeof err?.code === 'number' ? `, code: ${err.code}` : '';
    console.error(`[Database] MongoDB connection failed (${errorName}${errorCode}).`);
    throw err;
  }
}

/**
 * Ensures all required collections exist in the dedicated database puzzles_assessment_dev
 * but DOES NOT insert any demo, sample, or seed data. All collections remain clean for real production entry.
 */
export async function ensureCollectionStructures() {
  const db = mongoose.connection.db;
  if (!db) {
    console.warn('[Database] Mongoose database object not available');
    return;
  }

  const existingCollections = (await db.listCollections().toArray()).map((c) => c.name);
  const requiredCollections = [
    'users',
    'schools',
    'questiongroups',
    'questions',
    'publishedtests',
    'studenttestassignments',
    'publishhistories',
    'assessmenttemplates',
  ];

  for (const coll of requiredCollections) {
    if (!existingCollections.includes(coll)) {
      try {
        await db.createCollection(coll);
        console.log(`[Database] Verified empty collection '${coll}' in puzzles_assessment_dev`);
      } catch (err: any) {
        // collection already exists
      }
    }
  }

  try {
    await UserModel.createIndexes();
    console.log('[Database] Verified UserModel compound unique indexes in puzzles_assessment_dev');
  } catch (err: any) {
    console.warn('[Database] UserModel createIndexes notice:', err.message);
  }

  console.log('[Database] puzzles_assessment_dev collections verified ready with zero sample data.');
}

/**
 * Ensures ONLY the designated initial Super Admin ('san') exists if no Super Admin is registered.
 * Enforces mustChangePassword: true. No other credentials (admin, Rolecall, etc.) or demo entities are added.
 */
export async function ensureInitialSuperAdmin() {
  try {
    const existingSuperAdmin = await UserModel.findOne({
      $or: [{ role: 'super_admin' }, { username: 'san' }],
    });
    if (!existingSuperAdmin) {
      const username = 'san';
      const password = 'san';
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      await UserModel.create({
        username,
        role: 'super_admin',
        passwordHash,
        mustChangePassword: true,
      });

      console.log(`[Database] Initial Super Admin 'san' initialized in Atlas puzzles_assessment_dev with mustChangePassword: true.`);
    } else {
      console.log(`[Database] Verified existing Super Admin '${existingSuperAdmin.username}' in Atlas (mustChangePassword: ${existingSuperAdmin.mustChangePassword}). Existing credentials preserved.`);
    }
  } catch (err: any) {
    console.error('[Database] Failed to verify/initialize initial Super Admin:', err.message);
  }
}

export function getMongoConnectionInfo() {
  const isConnected = mongoose.connection.readyState === 1;
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    status: isConnected ? 'connected' : 'disconnected',
  };
}

export async function closeMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
