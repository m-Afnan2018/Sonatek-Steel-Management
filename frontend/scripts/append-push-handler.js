#!/usr/bin/env node
// Appended to sw.js after every next build so push handlers survive Workbox regeneration.
const fs = require('fs');
const path = require('path');

const sw      = path.join(__dirname, '../public/sw.js');
const handler = path.join(__dirname, '../public/push-handler.js');

if (!fs.existsSync(sw))      { console.error('[push] sw.js not found — skipping'); process.exit(0); }
if (!fs.existsSync(handler)) { console.error('[push] push-handler.js not found — skipping'); process.exit(0); }

const swContent = fs.readFileSync(sw, 'utf8');
if (swContent.includes('push-handler-appended')) {
  console.log('[push] push-handler already appended — skipping');
  process.exit(0);
}

const handlerContent = '\n// push-handler-appended\n' + fs.readFileSync(handler, 'utf8');
fs.appendFileSync(sw, handlerContent);
console.log('[push] push-handler.js appended to sw.js');
