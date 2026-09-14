import type { RequestHandler } from 'express';

// UMA fork policy: request telemetry collection is intentionally disabled.
const requestCounterMiddleware: RequestHandler = (_req, _res, next) => next();

export default requestCounterMiddleware;
