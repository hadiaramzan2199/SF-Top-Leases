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

// NOTE: no '/api' prefix here. Netlify's redirect rule sends browser requests
// from /api/* to /.netlify/functions/api/:splat, and the Netlify Functions
// runtime strips the function's own base path ("/.netlify/functions/api")
// before handing the remaining path to this Express app via serverless-http.
// So Express must match on the bare paths below, not '/api/...'.
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sf-top-leases-ytd-api' });
});

app.use('/properties', properties);
app.use('/leases', leases);
app.use('/transactions', transactions);
app.use('/stats', stats);
app.use('/uploads', uploads);
app.use('/bulk', bulk);

app.use((_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal error' });
});

export default app;
