import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { UserRole } from '../types.ts';

// SEC-HIGH-03: Strictly validate JWT_SECRET from environment.
// Server startup MUST fail safely if JWT_SECRET is missing or invalid.
// Do NOT use a default secret. Do NOT silently continue with an insecure secret.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '' || secret.trim().length < 16) {
    throw new Error(
      'Fatal Error: JWT_SECRET environment variable is missing, empty, or insufficient (min 16 chars). Server startup aborted.'
    );
  }
  return secret.trim();
}

const JWT_SECRET = getJwtSecret();

import { sharedStore } from '../services/sharedStore.ts';

// SEC-MED-04 & SCAL-LOW-01: Shared store token revocation registry (Redis + Memory fallback)
export function revokeToken(token: string): void {
  sharedStore.revokeToken(token).catch((err) => {
    console.warn('[Auth] Token revocation error:', err.message);
  });
}

export function isTokenRevoked(token: string): boolean {
  return sharedStore.isTokenRevokedSync(token);
}

export interface AuthUserPayload {
  userId: string;
  username: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  studentId?: string;
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      token?: string;
    }
  }
}

export function generateToken(payload: AuthUserPayload): string {
  const tokenPayload = {
    ...payload,
    jti: crypto.randomUUID(),
  };
  const expiresIn = process.env.JWT_EXPIRES_IN || '2h';
  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication token missing or invalid' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // SEC-MED-04 & SCAL-LOW-01: Ensure revoked tokens cannot be reused across instances
  const tokenRevoked = await sharedStore.isTokenRevoked(token);
  if (tokenRevoked) {
    res.status(401).json({ error: 'Token has been revoked or expired. Please sign in again.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    if (decoded.jti) {
      const jtiRevoked = await sharedStore.isTokenRevoked(decoded.jti);
      if (jtiRevoked) {
        res.status(401).json({ error: 'Token has been revoked or expired. Please sign in again.' });
        return;
      }
    }
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token expired or invalid' });
    return;
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access forbidden: Insufficient permissions' });
      return;
    }
    next();
  };
}

// SEC-INFO-02: Audited school isolation middleware helper
export function checkSchoolIsolation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  // Super Admin can access all schools
  if (req.user.role === 'super_admin') {
    return next();
  }

  // School Admin and Student can only access their assigned school
  const requestedSchoolId = req.params.schoolId || req.query.schoolId || req.body.schoolId;
  if (requestedSchoolId && req.user.schoolId && requestedSchoolId !== req.user.schoolId) {
    res.status(403).json({ error: 'Forbidden: Access restricted to your own school workspace' });
    return;
  }
  next();
}
