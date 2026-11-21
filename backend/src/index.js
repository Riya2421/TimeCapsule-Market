'use strict';
const { createApp } = require('./server');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const app = createApp();
app.listen(port, host).then(() => {
  console.log(`TimeCapsule Market running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(app.demo ? 'Demo controls are ON (set DEMO=0 to switch them off).' : 'Demo controls are OFF.');
  console.log('Logins: demo@timecapsule.in / demo123   admin@timecapsule.in / admin123');
});
const stop = () => app.close().then(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
