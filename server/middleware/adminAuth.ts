// server/middleware/adminAuth.ts
//
// Authentication middleware and helpers for all /api/admin/* routes.
//
// Two separate authentication mechanisms are in play:
//
//   1. JWT-based (primary) — adminAuthMiddleware
//      The React admin dashboard (and the vanilla-JS public/admin/index.html)
//      authenticate via Supabase.  After login the client receives a JWT from
//      Supabase and sends it as "Authorization: Bearer <token>" on every API
//      request.  This middleware verifies the token with verifyToken() and
//      attaches the decoded payload to req.adminUser so route handlers can
//      read req.adminUser.id and req.adminUser.email.
//
//   2. Session-based (legacy/simple) — handleAdminLogin / handleAdminLogout
//      An older password-only login flow that stores a boolean flag in the
//      Express session.  Still mounted in server/index.ts for backwards
//      compatibility with the static admin HTML page.

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt.js';

/** Extends the Express Request type so TypeScript knows adminUser is available after the middleware runs. */
interface AdminRequest extends Request {
  adminUser?: any;
}

/**
 * Express middleware that validates the Bearer JWT on every admin API request.
 *
 * On success: attaches the decoded token payload to `req.adminUser` and calls next().
 * On failure: returns 401 immediately without calling next().
 *
 * Note: this middleware only checks token validity (signature + expiry).
 * It does NOT verify that the user has isAdmin=true in the database.
 * Each route handler performs that second check via the isAdmin() helper
 * in adminRoutes.ts — keeping the middleware fast and stateless.
 */
export const adminAuthMiddleware = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // Reject requests without a Bearer token.
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const token   = authHeader.split('Bearer ')[1];
    const payload = verifyToken(token);  // returns null if expired or tampered

    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }

    // Attach decoded payload (id, email, isAdmin, …) for downstream use.
    req.adminUser = payload;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
};

/**
 * POST /api/admin/login (legacy session-based login)
 *
 * Compares the submitted password against the ADMIN_PASSWORD environment variable.
 * On success, sets `req.session.admin = true` so subsequent requests from the
 * same browser session are recognised as authenticated.
 *
 * Used by the static public/admin/index.html password form.
 * JWT-authenticated clients (React dashboard) do not use this route.
 */
export const handleAdminLogin = (req: Request, res: Response) => {
  const { password }       = req.body;
  const correctPassword    = process.env.ADMIN_PASSWORD;

  if (!password)              return res.status(400).json({ error: 'Password required' });
  if (password !== correctPassword) return res.status(401).json({ error: 'Incorrect password' });

  // Mark the session as authenticated.
  if (req.session) (req.session as any).admin = true;
  res.json({ success: true, message: 'Admin login successful' });
};

/**
 * POST /api/admin/logout (legacy session-based logout)
 *
 * Clears the session admin flag.  The session cookie itself is preserved
 * (express-session manages its own lifecycle); only the admin flag is removed.
 */
export const handleAdminLogout = (req: Request, res: Response) => {
  if (req.session) (req.session as any).admin = false;
  res.json({ success: true, message: 'Logged out' });
};
