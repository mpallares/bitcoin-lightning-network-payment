import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger, createRequestLogger } from '../lib/logger.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id: string;
      log: typeof logger;
    }
  }
}

/**
 * Middleware that adds request ID and logger to each request
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate or use existing request ID
  req.id = (req.headers['x-request-id'] as string) || randomUUID();
  req.log = createRequestLogger(req.id);

  // Add request ID to response headers
  res.setHeader('x-request-id', req.id);

  const start = Date.now();

  // Log request
  req.log.info({ method: req.method, url: req.url }, 'Request started');

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    req.log.info(
      { method: req.method, url: req.url, status: res.statusCode, duration: `${duration}ms` },
      'Request completed'
    );
  });

  next();
};
