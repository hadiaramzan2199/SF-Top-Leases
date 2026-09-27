import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import properties from './routes/properties.js';
import leases from './routes/leases.js';
import transactions from './routes/transactions.js';
import stats from './routes/stats.js';
import uploads from './routes/uploads.js';
import bulk from './routes/bulk.js';

dotenv.config();

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin/server-to-server requests may not include an Origin header.
      if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sf-top-leases-ytd-api' });
});

app.use('/api/properties', properties);
app.use('/api/leases', leases);
app.use('/api/transactions', transactions);
app.use('/api/stats', stats);
app.use('/api/uploads', uploads);
app.use('/api/bulk', bulk);

app.use((_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal error' });
});

export default app;
