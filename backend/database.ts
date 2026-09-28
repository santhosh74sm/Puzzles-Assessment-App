import mongoose from 'mongoose';
import {
  UserModel,
  SchoolModel,
  QuestionGroupModel,
  QuestionModel,
  PublishedTestModel,
  StudentTestAssignmentModel,
  PublishHistoryModel,
} from '../database/models.ts';
import bcrypt from 'bcryptjs';

export async function connectMongoDB(): Promise<{ uri: string; isConnected: boolean; dbName: string }> {
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

    // Mask credentials for logs
    const maskedUri = finalUri.replace(/:([^@/]+)@/, ':****@');
    console.log(`[Database] Connecting exclusively to MongoDB Atlas at: ${maskedUri}`);

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

    return { uri: maskedUri, isConnected: true, dbName: mongoose.connection.name };
  } catch (err: any) {
    console.error(`[Database] Error connecting to MongoDB:`, err.message);
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

  console.log('[Database] puzzles_assessment_dev collections verified ready with zero sample data.');
}

/**
 * Ensures ONLY the designated initial Super Admin ('san') exists if no Super Admin is registered.
 * Enforces mustChangePassword: true. No other credentials (admin, Rolecall, etc.) or demo entities are added.
 */
export async function ensureInitialSuperAdmin() {
  try {
    const existingSuperAdmin = await UserModel.findOne({ role: 'super_admin' });
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
    }
  } catch (err: any) {
    console.error('[Database] Failed to verify/initialize initial Super Admin:', err.message);
  }
}

export function getMongoConnectionInfo() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  const maskedUri = uri ? uri.replace(/:([^@/]+)@/, ':****@') : 'Not Configured';

  return {
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || 'unknown',
    port: mongoose.connection.port || 0,
    dbName: mongoose.connection.name || 'puzzles_assessment_dev',
    uri: maskedUri,
  };
}

export async function closeMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
