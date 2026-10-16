import 'dotenv/config';

import express from 'express';
import { createServer as createViteServer } from 'vite';
import routes from './backend/routes.ts';
import path from 'path';
import fs from 'fs';
import { connectMongoDB, getMongoConnectionInfo } from './backend/database.ts';
import { getJwtSecret } from './backend/middleware/auth.ts';

async function startServer() {
  const app = express();
  // Port configuration:
  // - In development (e.g. `npm run dev`), the dev server listens on port 3000 (proxied by Nginx).
  // - In Cloud Run production deployment, Cloud Run injects PORT (typically 8080) and sends
  //   deployment health checks to that port. The server must bind to process.env.PORT.
  const isDevCommand = process.env.npm_lifecycle_event === 'dev';
  const targetPort = isDevCommand
    ? (Number(process.env.PORT) || Number(process.env.DEFAULT_APP_PORT) || 3000)
    : (Number(process.env.PORT) || Number(process.env.DEFAULT_APP_PORT) || 8080);
  const fallbackPort = 3000;
  const HOST = '0.0.0.0';

  // JWT_SECRET security enforcement: Fail safely in production if missing or invalid (<32 chars)
  try {
    getJwtSecret();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  // SEC-MED-05: HTTP Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss:; frame-ancestors 'self' https://*.google.com https://*.run.app;"
    );
    next();
  });

  app.use(express.json());

  // Root and API health check endpoints for Cloud Run / Nginx container probes
  // SEC-LOW-01: Public health endpoints must NOT expose hostnames, ports, URIs, or internal topology
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
        status: info.isConnected ? 'connected' : 'disconnected',
        readyState: info.readyState,
      },
    });
  });

  // Database status and verification endpoint (Sanitized against info leakage)
  app.get('/api/database/status', (_req, res) => {
    const info = getMongoConnectionInfo();
    res.json({
      status: info.isConnected ? 'connected' : 'disconnected',
      readyState: info.readyState,
    });
  });

  // Serve downloadable static assets
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Mount API endpoints
  app.use('/api', routes);

  // Database connection error handler: Return clear error if MongoDB Atlas is unavailable
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      err?.name === 'MongooseError' ||
      err?.name === 'MongoNetworkError' ||
      err?.name === 'MongoServerSelectionError' ||
      (typeof err?.message === 'string' &&
        (err.message.includes('buffering timed out') ||
         err.message.includes('not connected') ||
         err.message.includes('connect ECONNREFUSED')))
    ) {
      console.error('[Database Error] MongoDB Atlas unavailable:', err.message || err);
      return res.status(503).json({
        error: 'Database connection error: MongoDB Atlas is currently unavailable. Please verify your MongoDB connection string and network configuration.',
        details: err.message,
      });
    }
    next(err);
  });

  // Determine whether running in production mode
  const distPath = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));
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

  function startListening(port: number, fallback?: number) {
    const serverInstance = app.listen(port, HOST, () => {
      console.log(`[System] Server listening on ${HOST}:${port} (mode: ${isProduction ? 'production' : 'development'})`);
    });

    serverInstance.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && fallback && fallback !== port) {
        console.warn(`[System] Port ${port} is in use (EADDRINUSE), attempting fallback to port ${fallback}...`);
        startListening(fallback);
      } else {
        console.error(`[System] Server listen error on port ${port}:`, err.message);
      }
    });

    return serverInstance;
  }

  startListening(targetPort, fallbackPort);

  // Establish and verify MongoDB Connection asynchronously so server startup is instantaneous
  console.log('[System] Initializing MongoDB database connection...');
  connectMongoDB()
    .then((dbInfo) => {
      console.log(`[System] Verified MongoDB connection to database: ${dbInfo.dbName}`);
    })
    .catch((err: any) => {
      const errorName = typeof err?.name === 'string' ? err.name : 'UnknownError';
      const errorCode = typeof err?.code === 'string' || typeof err?.code === 'number' ? `, code: ${err.code}` : '';
      console.warn(`[System] MongoDB connection unavailable (${errorName}${errorCode}).`);
    });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

