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
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';

  app.use(express.json());

  // Establish and verify MongoDB Connection exclusively to puzzles_assessment_dev
  console.log('[System] Initializing MongoDB database connection...');
  try {
    const dbInfo = await connectMongoDB();
    console.log(`[System] Verified MongoDB connection to: ${dbInfo.dbName} (${dbInfo.uri})`);
  } catch (err: any) {
    console.warn(`[System] MongoDB connection notice:`, err.message);
  }

  // Database status and verification endpoint
  app.get('/api/database/status', (req, res) => {
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

  // Backend health check endpoint
  app.get('/api/health', (req, res) => {
    const info = getMongoConnectionInfo();
    res.json({
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

  // Serve downloadable static assets
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Mount API endpoints
  app.use('/api', routes);

  // Determine whether running in production mode
  const distPath = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE) ||
    (hasDist && process.env.NODE_ENV !== 'development' && PORT !== 3000);

  if (isProduction && hasDist) {
    console.log(`[System] Running in production mode, serving built SPA from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
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

  app.listen(PORT, HOST, () => {
    console.log(`[System] Server listening on ${HOST}:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

