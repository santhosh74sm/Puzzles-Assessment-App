import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import routes from './backend/routes.ts';
import path from 'path';
import fs from 'fs';
import { connectMongoDB, getMongoConnectionInfo } from './backend/database.ts';

async function startServer() {
  const app = express();
  // In AI Studio Cloud Run, Nginx reverse proxy listens on 8080 and proxies traffic to 3000.
  // Cloud Run sets PORT=8080 in the container environment. If the app tries to bind to 8080,
  // it collides with Nginx (EADDRINUSE: address already in use 0.0.0.0:8080).
  // The app must always listen on port 3000 (DEFAULT_APP_PORT).
  const PORT = (process.env.PORT && process.env.PORT !== '8080')
    ? Number(process.env.PORT)
    : (Number(process.env.DEFAULT_APP_PORT) || 3000);
  const HOST = '0.0.0.0';

  app.use(express.json());

  // Root and API health check endpoints for Cloud Run / Nginx container probes
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'Puzzles Assessment Engine' });
  });

  app.get('/api/health', (_req, res) => {
    const info = getMongoConnectionInfo();
    res.status(200).json({
      status: 'ok',
      service: 'Puzzles Assessment Engine (Node.js + Express)',
      uptime: process.uptime(),
      database: {
        type: 'MongoDB Atlas',
        targetDatabase: 'puzzles_assessment_dev',
        status: info.isConnected ? 'connected' : 'disconnected',
        readyState: info.readyState,
        host: info.host,
        dbName: info.dbName,
        uri: info.uri,
      },
    });
  });

  // Database status and verification endpoint
  app.get('/api/database/status', (_req, res) => {
    const info = getMongoConnectionInfo();
    res.json({
      status: info.isConnected ? 'connected' : 'disconnected',
      readyState: info.readyState,
      dbName: info.dbName,
      host: info.host,
      port: info.port,
      uri: info.uri,
    });
  });

  // Serve downloadable static assets
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Mount API endpoints
  app.use('/api', routes);

  // Determine whether running in production mode
  const distPath = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));
  const isDevCommand = process.env.npm_lifecycle_event === 'dev';
  const isProduction = hasDist && (process.env.NODE_ENV === 'production' || !isDevCommand);

  if (isProduction && hasDist) {
    console.log(`[System] Running in production mode, serving built SPA from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    console.log('[System] Running in development mode with Vite middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[System] Server listening on ${HOST}:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });

  server.on('error', (err: any) => {
    console.error(`[System] Server listen error on port ${PORT}:`, err.message);
  });

  // Establish and verify MongoDB Connection asynchronously so server startup is instantaneous
  console.log('[System] Initializing MongoDB database connection...');
  connectMongoDB()
    .then((dbInfo) => {
      console.log(`[System] Verified MongoDB connection to: ${dbInfo.dbName} (${dbInfo.uri})`);
    })
    .catch((err: any) => {
      console.warn(`[System] MongoDB connection notice:`, err.message);
    });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

