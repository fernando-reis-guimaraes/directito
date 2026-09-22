import { InvalidPayloadError } from '@directus/errors';
import { Router } from 'express';
import Joi from 'joi';
import { respond } from '../middleware/respond.js';
import { EmbeddedSitesService } from '../services/embedded-sites.js';
import asyncHandler from '../utils/async-handler.js';

const router = Router();

const sessionSchema = Joi.object({
	site_id: Joi.string().required(),
});

const redeemSchema = Joi.object({
	site_id: Joi.string().required(),
	code: Joi.string().required(),
});

router.post(
	'/session',
	asyncHandler(async (req, res, next) => {
		const { error } = sessionSchema.validate(req.body);

		if (error) throw new InvalidPayloadError({ reason: error.message });

		const service = new EmbeddedSitesService({ accountability: req.accountability ?? null, schema: req.schema });

		const { code, expires_in } = await service.createSessionCode(req.body.site_id);

		res.locals['payload'] = { data: { code, expires_in } };

		return next();
	}),
	respond,
);

router.post(
	'/session/redeem',
	asyncHandler(async (req, res, next) => {
		const { error } = redeemSchema.validate(req.body);

		if (error) throw new InvalidPayloadError({ reason: error.message });

		const service = new EmbeddedSitesService({ accountability: req.accountability ?? null, schema: req.schema });

		res.locals['payload'] = { data: await service.redeemSessionCode(req.body.site_id, req.body.code) };

		return next();
	}),
	respond,
);

export default router;
