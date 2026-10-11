const dns = require('node:dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is missing. Copy .env.example to .env and configure MongoDB.');
  process.exit(1);
}

async function start() {
  await mongoose.connect(mongoUri);
  app.listen(port, () => console.log(`Inventory API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error('Could not start the Inventory API:', error.message);
  process.exit(1);
});

async function stop() {
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
