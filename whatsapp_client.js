const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

const headless = process.env.PUPPETEER_HEADLESS === 'false' ? false : true;
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'main' }),
  puppeteer: { headless, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=800,800'] }
});

client.on('qr', (qr) => {
  console.log('=== QR RECEIVED - escaneie com seu WhatsApp ===');
  qrcode.generate(qr, { small: true });
  // salvar imagem do QR para facilitar escaneamento (qr.png)
  try {
    const out = require('path').join(__dirname, 'qr.png');
    QRCode.toFile(out, qr, { type: 'png' }, (err) => {
      if (err) console.error('Erro ao salvar qr.png', err);
      else console.log('QR salvo em', out);
    });
  } catch (e) {
    console.error('Não foi possível salvar QR:', e);
  }
  console.log('Se o QR expirar, reinicie este script para gerar outro.');
});

client.on('ready', () => {
  console.log('WhatsApp client pronto.');
});

client.on('auth_failure', msg => {
  console.error('Falha na autenticação:', msg);
});

client.on('message', async (message) => {
  try {
    console.log(`Mensagem de ${message.from}: ${message.id.id} tipo=${message.type}`);

    if (message.hasMedia) {
      const media = await message.downloadMedia();
      if (!media || !media.data) return;
      const mime = media.mimetype || 'application/octet-stream';
      const ext = mime.split('/')[1]?.split('+')?.[0] || 'bin';
      const filename = `${Date.now()}_${message.id.id}.${ext}`;
      const filepath = path.join(downloadsDir, filename);
      const buffer = Buffer.from(media.data, 'base64');
      fs.writeFileSync(filepath, buffer);
      console.log('Mídia salva em', filepath);

      // Se for áudio/voz, responder ack e log
      if (mime.startsWith('audio')) {
        await message.reply('Áudio recebido — salvando e pronto para transcrição.');
      } else {
        await message.reply('Mídia recebida e salva.');
      }
    } else {
      // comando simples: enviar arquivo salvo
      if (message.body && message.body.toLowerCase() === 'ping') {
        await message.reply('pong');
      }
    }
  } catch (err) {
    console.error('Erro ao processar mensagem:', err);
  }
});

client.initialize();
