const jwt = require('jsonwebtoken');
const { readDb, publicUser } = require('../lib/store');
const { env } = require('../config/env');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token.' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const db = await readDb();
    const user = db.users.find((u) => u.id === payload.sub);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'User is not active or does not exist.' });
    }

    req.user = publicUser(user);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function permit(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { authenticate, permit, signToken };
