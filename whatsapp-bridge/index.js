const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const APP_DIR = path.resolve(__dirname);
const QR_PATH = path.join(APP_DIR, 'qrcode.png');
const LOG_PATH = path.join(APP_DIR, 'messages.log');
const ALLOWED_PATH = path.join(APP_DIR, 'allowed_targets.json');

const app = express();
app.use(bodyParser.json());

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'openclaw-whatsapp' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

let latestQr = null;

// --- Robust send queue + sanitization + supervisor ---
const SEND_RETRY_LIMIT = 3;
const SEND_RETRY_BASE_MS = 1000;
let sendQueue = [];
let processingQueue = false;

function sanitizeText(t) {
  if (!t) return '';
  // remove ANSI/control chars
  return t.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 4000);
}

async function processQueue() {
  if (processingQueue) return;
  processingQueue = true;
  while (sendQueue.length) {
    const item = sendQueue.shift();
    const { to, message, tries = 0 } = item;
    try {
      const sanitized = sanitizeText(message);
      const chatId = to.endsWith('@c.us') ? to : `${to}@c.us`;
      const sent = await client.sendMessage(chatId, sanitized);
      console.log('Queued send success ->', chatId, sent && sent.id ? sent.id._serialized : 'no-id');
      // small delay between sends
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.error('Queued send failed', e);
      if (tries + 1 < SEND_RETRY_LIMIT) {
        // exponential backoff
        const delay = SEND_RETRY_BASE_MS * Math.pow(2, tries);
        console.log(`Retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        sendQueue.unshift({ to: item.to, message: item.message, tries: tries + 1 });
      } else {
        console.error('Giving up sending to', item.to);
        // write to failed log for later inspection
        try { fs.appendFileSync(path.join(APP_DIR, 'failed_sends.log'), `${new Date().toISOString()} ${item.to}: ${item.message}\n`); } catch (_) {}
        // notify owner if configured
        notifyOwner(`Falha ao enviar mensagem para ${item.to}: ${String(e).slice(0,200)}`);
      }
    }
  }
  processingQueue = false;
}

function enqueueSend(to, message) {
  sendQueue.push({ to, message, tries: 0 });
  // fire-and-forget processing
  processQueue().catch(err => console.error('processQueue error', err));
}

function notifyOwner(text) {
  const owner = process.env.OWNER_NUMBER;
  if (!owner) return;
  try {
    // push to queue so notify also benefits from retries
    enqueueSend(owner, `[bridge alert] ${text}`);
  } catch (e) { console.error('notifyOwner failed', e); }
}

// Simple supervisor: attempt client re-init on disconnect/auth failure
let lastRestart = 0;
async function attemptClientRestart(reason) {
  const now = Date.now();
  if (now - lastRestart < 10000) return; // avoid tight loops
  lastRestart = now;
  console.warn('Attempting client re-initialize due to', reason);
  try {
    client.destroy();
  } catch (e) {}
  try {
    await client.initialize();
    notifyOwner('Bridge re-initialized after: ' + reason);
  } catch (e) {
    console.error('Re-init failed', e);
    notifyOwner('Bridge failed to reinitialize: ' + String(e).slice(0,200));
  }
}

client.on('qr', async (qr) => {
  latestQr = qr;
  try {
    await qrcode.toFile(QR_PATH, qr);
    console.log('QR saved to', QR_PATH);
  } catch (e) {
    console.error('Failed to save QR:', e);
  }
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.on('auth_failure', (reason) => {
  console.error('AUTH FAILURE', reason);
  notifyOwner('AUTH FAILURE: ' + String(reason).slice(0,200));
  attemptClientRestart('auth_failure');
});

// Basic message handling: log, optional autorespond, and simple forwarding (log already)
// Auto-reply map (kept empty to avoid repeating presentations)
const autoReplyContacts = {};

function getAllowedTargets() {
  try {
    if (!fs.existsSync(ALLOWED_PATH)) return new Set();
    const raw = fs.readFileSync(ALLOWED_PATH, 'utf8') || '[]';
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(s => s.toString()));
  } catch (e) {
    console.error('failed to load allowed targets', e);
    return new Set();
  }
}

client.on('message', async msg => {
  const from = msg.from;
  const body = msg.body || '';
  const line = `${new Date().toISOString()} ${from}: ${body}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch (e) { console.error('log append failed', e); }
  console.log('Message logged:', line.trim());

  // normalize
  let senderId = from;
  try {
    const contact = await client.getContactById(from).catch(() => null);
    if (contact && contact.id && contact.id._serialized) senderId = contact.id._serialized;
  } catch (e) {}

  // Check allowed targets file; ignore if not listed
  const allowed = getAllowedTargets();
  if (!allowed.has(senderId) && !allowed.has(from)) return;

  // Build contextual reply
  const low = body.toLowerCase();
  let reply = null;
  if (/temperatura|clima|tempo/.test(low)) {
    // detect location words
    if (/noronha/.test(low)) {
      try {
        const out = require('child_process').execSync("curl -s \"wttr.in/Fernando+de+Noronha?format=%c+%t\"").toString().trim();
        reply = `Agora em Fernando de Noronha está: ${out}. Quer a previsão para amanhã?`;
      } catch (e) { reply = 'Posso checar o clima de Noronha, quer que eu consulte agora?'; }
    } else if (/jardim/.test(low) || /saude/.test(low)) {
      try {
        const out = require('child_process').execSync("curl -s \"wttr.in/Jardim+da+Saude+Sao+Paulo?format=%c+%t\"").toString().trim();
        reply = `Agora no Jardim da Saúde está ${out}. Quer que eu te envie a previsão completa para hoje?`;
      } catch (e) { reply = 'Posso checar a temperatura, quer que eu consulte agora?'; }
    } else {
      try {
        const out = require('child_process').execSync("curl -s \"wttr.in/Cotia?format=%c+%t\"").toString().trim();
        reply = `Posso checar a temperatura do local que você quiser. Como exemplo (Cotia): ${out}`;
      } catch (e) { reply = 'Posso checar a temperatura, quer que eu consulte agora?'; }
    }
  } else if (/oi\b|olá|hello|hi|sir/.test(low)) {
    reply = 'Oi! Em que posso ajudar?';
  } else if (/capital da espanha/.test(low)) {
    reply = 'A capital da Espanha é Madrid. Quer que eu te passe algo sobre a cidade?';
  } else if (/capital do egito/.test(low)) {
    reply = 'A capital do Egito é Cairo. Quer que eu te passe algo sobre a cidade?';
  } else if (/claw\?|estou ai|está ai|está aí/.test(low)) {
    reply = 'Estou aqui — desculpe a demora. Em que posso ajudar?';
  } else {
    reply = 'Entendi — quer que eu procure isso pra você (sim/não) ou prefira que eu te envie opções?';
  }

  if (reply) enqueueSend(senderId, reply);
});

client.initialize();

// Web UI endpoints
app.get('/qrcode', (req, res) => {
  if (fs.existsSync(QR_PATH)) return res.sendFile(QR_PATH);
  if (latestQr) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send(latestQr);
  }
  res.status(404).send('QR not available yet');
});

app.get('/status', (req, res) => {
  const status = {
    qrAvailable: fs.existsSync(QR_PATH),
    messagesLog: fs.existsSync(LOG_PATH)
  };
  res.json(status);
});

app.get('/messages', (req, res) => {
  if (!fs.existsSync(LOG_PATH)) return res.send('No messages logged yet');
  res.sendFile(LOG_PATH);
});

// Contacts search: /contacts?q=Priscila
app.get('/contacts', async (req, res) => {
  const q = (req.query.q || req.query.query || '').toString().trim();
  try {
    const contacts = await client.getContacts();
    if (!q) return res.json(contacts.map(c => ({ id: c.id && c.id._serialized, pushname: c.pushname, name: c.name })));
    const qlow = q.toLowerCase();
    const matches = contacts.filter(c => {
      const push = (c.pushname || '').toString().toLowerCase();
      const name = (c.name || '').toString().toLowerCase();
      const number = (c.id && c.id.user) ? c.id.user.toString() : '';
      return push.includes(qlow) || name.includes(qlow) || number.includes(qlow);
    }).map(c => ({ id: c.id && c.id._serialized, pushname: c.pushname, name: c.name }));
    return res.json(matches);
  } catch (e) {
    console.error('contacts error', e);
    res.status(500).json({ error: String(e) });
  }
});

// Send message API: POST { to: '<number-in-international-without-plus>', message: 'text' }
app.post('/send', async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: 'missing to or message' });
  const chatId = `${to}@c.us`;
  console.log('HTTP /send requested ->', chatId, message.slice(0,200));
  try {
    // enqueue send for reliability
    enqueueSend(to, message);
    res.json({ ok: true });
  } catch (e) {
    console.error('send error', e);
    res.status(500).json({ error: String(e) });
  }
});

// Self-test endpoint: sends a test message to the configured owner number (set via env OWNER_NUMBER)
app.post('/self-test', async (req, res) => {
  const owner = process.env.OWNER_NUMBER;
  if (!owner) return res.status(400).json({ error: 'OWNER_NUMBER not set' });
  try {
    await client.sendMessage(`${owner}@c.us`, 'Teste automático: bridge configurado e funcionando.');
    res.json({ ok: true });
  } catch (e) {
    console.error('self-test send error', e);
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bridge web UI listening on http://localhost:${PORT}`));
