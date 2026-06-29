import { verifyToken } from '../config/jwt.js';
export const adminAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
        }
        const token = authHeader.split('Bearer ')[1];
        const payload = verifyToken(token);
        if (!payload) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        }
        req.adminUser = payload;
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
};
export const handleAdminLogin = (req, res) => {
    const { password } = req.body;
    const correctPassword = process.env.ADMIN_PASSWORD;
    if (!password)
        return res.status(400).json({ error: 'Password required' });
    if (password !== correctPassword)
        return res.status(401).json({ error: 'Incorrect password' });
    if (req.session)
        req.session.admin = true;
    res.json({ success: true, message: 'Admin login successful' });
};
export const handleAdminLogout = (req, res) => {
    if (req.session)
        req.session.admin = false;
    res.json({ success: true, message: 'Logged out' });
};
