const express = require('express');
const { readDb, updateDb, VERTICALS } = require('../lib/store');
const { authenticate, permit } = require('../middleware/auth');
const { asyncRoute } = require('../utils/asyncRoute');

const router = express.Router();
router.use(authenticate);

function cleanList(value, fallback = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const cleaned = source
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+/g, ' '));
  const unique = [...new Set(cleaned)];
  return unique.length ? unique : fallback;
}

function publicSettings(settings = {}) {
  return {
    categories: cleanList(settings.categories, ['Poster', 'Hoarding', 'Brochure', 'Presentation', 'Social Media', 'Other']),
    priorities: cleanList(settings.priorities, ['Low', 'Medium', 'High', 'Urgent']),
    statuses: cleanList(settings.statuses, ['pending_acceptance', 'accepted', 'declined', 'in_progress', 'on_hold', 'submitted_for_review', 'changes_requested', 'completed', 'overdue']),
    verticals: cleanList(settings.verticals, VERTICALS),
    roles: Array.isArray(settings.roles) ? settings.roles : [
      { value: 'admin', label: 'Admin' },
      { value: 'bd', label: 'Business Developer (BD)' },
      { value: 'designer', label: 'Designer' }
    ]
  };
}

router.get('/', asyncRoute(async (req, res) => {
  const db = await readDb();
  res.json({ settings: publicSettings(db.settings) });
}));

router.patch('/', permit('admin'), asyncRoute(async (req, res) => {
  const settings = await updateDb((db) => {
    db.settings = db.settings || {};

    if (req.body.categories !== undefined) {
      db.settings.categories = cleanList(req.body.categories, db.settings.categories);
    }
    if (req.body.priorities !== undefined) {
      db.settings.priorities = cleanList(req.body.priorities, db.settings.priorities);
    }
    if (req.body.verticals !== undefined) {
      db.settings.verticals = cleanList(req.body.verticals, VERTICALS);
    }

    return publicSettings(db.settings);
  });

  res.json({ settings });
}));

module.exports = router;
