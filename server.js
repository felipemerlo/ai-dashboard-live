require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const APP_SECRET = process.env.APP_SECRET;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verify_me';
const PORT = process.env.PORT || 3000;
const GRAPH_V = process.env.GRAPH_V || 'v17.0';

const app = express();

// manter rawBody para verificação de assinatura
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// verificação GET do webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

function verifySignature(req) {
  const sigHeader = req.headers['x-hub-signature-256'];
  if (!sigHeader || !APP_SECRET) return false;
  const hmac = crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  return sigHeader === `sha256=${hmac}`;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  return res.json();
}

app.post('/webhook', async (req, res) => {
  try {
    if (!verifySignature(req)) return res.sendStatus(403);

    const body = req.body;
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const message = messages?.[0];
    if (!message) return res.sendStatus(200);

    // detectar mídia de áudio (voice note ou audio)
    const mediaId = message?.audio?.id || message?.voice?.id || message?.document?.id;
    if (!mediaId) {
      console.log('Mensagem recebida (não é mídia de áudio):', message?.type || message);
      return res.sendStatus(200);
    }

    console.log('Recebido media id:', mediaId);

    // 1) obter informações do media
    const mediaInfoUrl = `https://graph.facebook.com/${GRAPH_V}/${mediaId}`;
    const mediaInfo = await fetchJson(mediaInfoUrl + `?access_token=${META_ACCESS_TOKEN}`);
    const mediaUrl = mediaInfo.url;
    if (!mediaUrl) {
      console.error('media.url não disponível', mediaInfo);
      return res.sendStatus(500);
    }

    // 2) baixar binário (a URL também exige Authorization)
    const mediaResp = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } });
    if (!mediaResp.ok) {
      console.error('Erro ao baixar mídia', mediaResp.status);
      return res.sendStatus(500);
    }
    const arrayBuffer = await mediaResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3) salvar em ./downloads/
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
    // tentar extrair extensão do mime
    const mime = mediaInfo.mime_type || 'audio/ogg';
    const ext = mime.split('/')[1]?.split('+')?.[0] || 'ogg';
    const filename = `${Date.now()}_${mediaId}.${ext}`;
    const filepath = path.join(downloadsDir, filename);
    fs.writeFileSync(filepath, buffer);
    console.log('Áudio salvo em', filepath);

    // Aqui: opcionalmente transcrever/enfileirar/processar
    // Exemplo: chamar função transcribe(filepath) — não implementada por padrão.

    return res.sendStatus(200);
  } catch (err) {
    console.error('Erro no webhook:', err);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => console.log(`Webhook rodando na porta ${PORT}`));

// servir QR (se existir) e arquivos estáticos úteis
app.use('/static', express.static(path.join(__dirname)));
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'qr.png');
  if (fs.existsSync(qrPath)) {
    return res.send(`<!doctype html><meta charset="utf-8"><title>QR WhatsApp</title><p>Abra o WhatsApp no celular → Dispositivos conectados → Conectar um dispositivo e aponte a câmera para a imagem abaixo.</p><img src="/static/qr.png" style="max-width:100%;height:auto;"/>`);
  }
  return res.status(404).send('QR não encontrado. Gere novamente o QR no cliente.');
});
