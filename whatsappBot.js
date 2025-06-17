// whatsappBot.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const P = require('pino');
const express = require('express');
const axios = require('axios');
const config = require('./config');

let sock;  // 使用全域變數，以免被 override

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();
  console.log();

  // 建立 socket，設定全域 sock
  sock = makeWASocket({
    version,
    logger: P({ level: 'debug' }),
    printQRInTerminal: true,
    auth: state,
  });

  // Express API Server
  const app = express();
  app.use(express.json());
  app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).send('Internal Server Error');
  });

  // Telegram -> WhatsApp 轉發 API
  app.post('/fromTelegram', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).send('Missing message');

    try {
      console.log('🔄 Telegram->WhatsApp 發送:', message);
      await sock.sendMessage(config.whatsapp.chatId, { text: message });
      res.sendStatus(200);
    } catch (err) {
      console.error('Error sending message to WhatsApp group:', err.message || err);
      res.sendStatus(500);
    }
  });

  app.listen(config.whatsapp.port, () => {
    console.log();
  });

  // 保存憑證
  sock.ev.on('creds.update', saveCreds);

  // 連線狀態
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('請使用 WhatsApp 掃描下方 QR Code：');
 }
    if (connection === 'open') {
      console.log('WhatsApp connected successfully.');
      // 測試群組發送
      try {
        await sock.sendMessage(config.whatsapp.chatId, { text: '已上線' });
        console.log('測試上線訊息發送成功');
      } catch (err) {
        console.error('❌ 測試訊息發送失敗:', err.message || err);
      }
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('WhatsApp connection closed:', lastDisconnect?.error?.toString());
      if (shouldReconnect) {
        console.log('重連中...');
        startWhatsAppBot();
      } else {
        console.log('WhatsApp 已登出，請重新掃描登入');
      }
    }
  });

  // 監聽 WhatsApp 群組訊息
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      console.log('📩 來自 ID:', from);
      if (from !== config.whatsapp.chatId) return;
 // 擷取文字
      let text = '';
      if (msg.message.conversation) text = msg.message.conversation;
      else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
      else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;
      else if (msg.message.videoMessage?.caption) text = msg.message.videoMessage.caption;

      if (!text) return;
      const senderName = msg.pushName || 'Unknown';
      const formattedMsg = `[${senderName}: ${text}]`;

      console.log('🔄 WhatsApp->Telegram 轉發:', formattedMsg);
      await axios.post(`http://localhost:${config.telegram.port}/fromWhatsApp`, { message: formattedMsg });
    } catch (err) {
      console.error('Error forwarding message to Telegram bot:', err.message || err);
    }
  });
}

startWhatsAppBot();

