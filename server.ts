import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import routes from './backend/routes.ts';
import path from 'path';
import { connectMongoDB, getMongoConnectionInfo } from './backend/database.ts';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Establish and verify MongoDB Connection exclusively to puzzles_assessment_dev
  console.log('[System] Initializing MongoDB database connection...');
  connectMongoDB()
    .then((dbInfo) => {
      console.log(`[System] Verified MongoDB connection to: ${dbInfo.dbName} (${dbInfo.uri})`);
    })
    .catch((err: any) => {
      console.warn(`[System] MongoDB connection notice:`, err.message);
    });

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

  // Serve downloadable static assets (e.g. backend.zip)
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Mount API endpoints
  app.use('/api', routes);

  // In non-production, mount Vite middleware for React frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built SPA
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
