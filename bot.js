const { Boom } = require('@hapi/boom');
const {
    default: makeWASocket,
    useSingleFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const fs = require('fs');

const { state, saveState } = useSingleFileAuthState('./auth.json');
const dataFile = './data.json';

const loadData = () => JSON.parse(fs.readFileSync(dataFile));
const saveData = (data) => fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const sender = msg.key.remoteJid;

        const data = loadData();

        if (text.toLowerCase().startsWith('add fund')) {
            const match = text.match(/add fund (\d+)(?: by (.+))?/i);
            if (match) {
                const amount = parseInt(match[1]);
                const donor = match[2] || 'Anonymous';
                data.funds.push({ amount, donor });
                saveData(data);
                await sock.sendMessage(sender, { text: `Added fund of ${amount} by ${donor}.` });
            }
        }

        else if (text.toLowerCase().startsWith('add member')) {
            const name = text.split('add member ')[1];
            if (name && !data.members.includes(name)) {
                data.members.push(name);
                saveData(data);
                await sock.sendMessage(sender, { text: `${name} added to the team.` });
            } else {
                await sock.sendMessage(sender, { text: `Member already exists or invalid.` });
            }
        }

        else if (text.toLowerCase().startsWith('remove member')) {
            const name = text.split('remove member ')[1];
            if (data.members.includes(name)) {
                data.members = data.members.filter(m => m !== name);
                saveData(data);
                await sock.sendMessage(sender, { text: `${name} removed from the team.` });
            } else {
                await sock.sendMessage(sender, { text: `Member not found.` });
            }
        }

        else if (text.toLowerCase() === 'team name') {
            await sock.sendMessage(sender, { text: `Team Name: ${data.teamName}` });
        }

        else if (text.toLowerCase() === 'total fund') {
            const total = data.funds.reduce((sum, f) => sum + f.amount, 0);
            await sock.sendMessage(sender, { text: `Total fund collected: ${total}` });
        }
    });
}

startBot();
