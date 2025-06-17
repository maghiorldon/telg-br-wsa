const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const config = require('./config');

const bot = new TelegramBot(config.telegram.token, { polling: true });
const app = express();
app.use(express.json());

// API Server 接收 WhatsApp 傳來的訊息，發送至 Telegram 群組
app.post('/fromWhatsApp', async (req, res) => {
  try {
    const { message } = req.body;
    await bot.sendMessage(config.telegram.chatId, message);
    res.sendStatus(200);
  } catch (err) {
    console.error('Telegram API Server Error:', err);
    res.sendStatus(500);
  }
});

app.listen(config.telegram.port, () => {
  console.log(`Telegram API Server running on port ${config.telegram.port}`);
});

// 監聽 Telegram 群組訊息，轉發給 WhatsApp Bot API
bot.on('message', async (msg) => {
  if (msg.chat.id.toString() !== config.telegram.chatId) return; // 只處理設定群組
  if (msg.from.is_bot) return; // 忽略機器人訊息

  const sender = msg.from.first_name || 'Unknown';
  const text = msg.text || '';
  const formattedMsg = `[${sender}: ${text}]`;

  try {
    await axios.post(`http://localhost:${config.whatsapp.port}/fromTelegram`, { message: formattedMsg });
  } catch (err) {
    console.error('Error forwarding message to WhatsApp bot:', err.message);
  }
});
