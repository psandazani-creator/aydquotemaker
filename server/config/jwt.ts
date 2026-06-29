import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'aydqm-dev-secret-change-in-production';

export interface JwtPayload {
  id: string;
  email: string;
  isAdmin: boolean;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
