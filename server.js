/**
 * MUNDA — Textile Lighting Systems
 * Corporate website backend (Node.js + Express, no Python).
 *
 * Routes:
 *   GET  /            → home page
 *   GET  /technology  → technology page
 *   GET  /company     → company page
 *   GET  /sales       → sales page
 *   GET  /career      → career page
 *   GET  /game        → Spot the Difference mini-game
 *   GET  /contact     → contact page
 *   GET  /api/health  → service health + uptime
 *   GET  /api/messages→ list stored contact messages (for the site owner)
 *   POST /api/contact → store a contact form submission
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// ---------- helpers ----------

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]', 'utf8');
}

function readMessages() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeMessages(messages) {
  ensureDataDir();
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

/** Minimal validation: required fields, sane lengths, email format. */
function validateContact(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const company = String(body.company || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  const errors = [];
  if (!name || name.length > 120) errors.push('name is required (max 120 chars)');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    errors.push('a valid email is required');
  }
  if (company.length > 160) errors.push('company must be at most 160 chars');
  if (subject.length > 200) errors.push('subject must be at most 200 chars');
  if (!message || message.length < 10 || message.length > 5000) {
    errors.push('message is required (10–5000 chars)');
  }

  return {
    ok: errors.length === 0,
    errors,
    data: { name, email, company, subject, message },
  };
}

// ---------- middleware ----------

app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true }));

// Security-conscious headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ---------- static ----------

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// ---------- pages ----------

const pages = ['technology', 'company', 'sales', 'career', 'game', 'contact'];
for (const page of pages) {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, `${page}.html`));
  });
}

// ---------- api ----------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'munda-website', uptime: process.uptime(), now: new Date().toISOString() });
});

app.get('/api/messages', (req, res) => {
  res.json({ count: readMessages().length, messages: readMessages() });
});

app.post('/api/contact', (req, res) => {
  const result = validateContact(req.body || {});
  if (!result.ok) {
    return res.status(400).json({ ok: false, errors: result.errors });
  }

  const record = {
    id: crypto.randomUUID(),
    ...result.data,
    createdAt: new Date().toISOString(),
    ip: req.ip,
  };

  const messages = readMessages();
  messages.push(record);
  writeMessages(messages);

  res.status(201).json({
    ok: true,
    message: 'Thank you! Your message has been received — we will get back to you shortly.',
    id: record.id,
  });
});

// ---------- 404 & error handling ----------

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ---------- start ----------

app.listen(PORT, () => {
  console.log(`MUNDA website running → http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/api/health`);
});
