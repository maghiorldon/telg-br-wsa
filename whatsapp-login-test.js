const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    logger: P({ level: 'info' }),
    printQRInTerminal: true,  // Baileys 會自動在終端機印出 QR code
    auth: state,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    console.log('connection update:', connection);

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('連線關閉:', lastDisconnect?.error?.toString());

      if (shouldReconnect) {
        console.log('嘗試重連...');
        main();
      } else {
        console.log('WhatsApp 已登出，請重新掃描 QR Code');
      }
    }

    if (connection === 'open') {
      console.log('✅ 已成功連線 WhatsApp');
    }
  });
}

main();
