const express = require('express');
const bcrypt = require('bcryptjs');
const { readDb, publicUser } = require('../lib/store');
const { authenticate, signToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { asyncRoute } = require('../utils/asyncRoute');

const router = express.Router();

router.post('/login', authLimiter, asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const db = await readDb();
  const user = db.users.find((u) => u.email === String(email).toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: 'Your account is inactive. Contact admin.' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
