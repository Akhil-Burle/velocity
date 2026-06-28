/**
 * middleware/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT verification middleware. Extracts userId from Bearer token and attaches
 * it to req.userId. All protected routes use this middleware.
 *
 * Returns 401 if no token is provided or if the token is invalid/expired.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Hard-fail on startup in production so misconfigured deploys are caught immediately.
  if (process.env.NODE_ENV === 'production') {
    console.error('[Auth] FATAL: JWT_SECRET environment variable is not set. Exiting.');
    process.exit(1);
  } else {
    console.warn('[Auth] WARNING: JWT_SECRET not set — using insecure dev fallback. Set JWT_SECRET in .env before deploying.');
  }
}
const _JWT_SECRET = JWT_SECRET || 'velocity-dev-only-insecure-fallback-do-not-use-in-production';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No authentication token provided. Please log in or continue as guest.',
    });
  }

  const token = header.slice(7); // strip "Bearer "

  try {
    const payload = jwt.verify(token, _JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token is invalid or expired. Please log in again.',
    });
  }
}

/**
 * Helper to sign a new JWT for a given userId.
 * 24h expiry for guest sessions; 7d for named users.
 */
function signToken(userId, expiresIn = '24h') {
  return jwt.sign({ userId }, _JWT_SECRET, { expiresIn });
}

module.exports = { requireAuth, signToken };
