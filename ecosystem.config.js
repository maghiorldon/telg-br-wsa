module.exports = {
  apps: [
    {
      name: 'whatsapp-bot',
      script: './whatsappBot.js',
      watch: false,
    },
    {
      name: 'telegram-bot',
      script: './telegramBot.js',
      watch: false,
    }
  ]
}
