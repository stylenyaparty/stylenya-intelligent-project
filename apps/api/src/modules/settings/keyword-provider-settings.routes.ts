import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../interfaces/http/middleware/auth.js";
import {
    getGoogleAdsStatus,
    updateGoogleAdsSettings,
} from "./keyword-provider-settings.service.js";
import { isAppError } from "../../types/app-error.js";

const googleAdsSchema = z.object({
    enabled: z.boolean(),
    customerId: z.string().optional(),
    developerToken: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    refreshToken: z.string().optional(),
});

export async function keywordProviderSettingsRoutes(app: FastifyInstance) {
    app.get(
        "/settings/keyword-providers",
        { preHandler: [requireAuth] },
        async () => {
            const googleAds = await getGoogleAdsStatus();
            return {
                googleAds,
            };
        }
    );

    app.post(
        "/settings/google-ads",
        { preHandler: [requireAuth] },
        async (request, reply) => {
            try {
                const body = googleAdsSchema.parse(request.body);
                const googleAds = await updateGoogleAdsSettings(body);
                return reply.code(200).send({ ok: true, googleAds });
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                return reply.code(400).send({
                    code: "INVALID_SETTINGS_PAYLOAD",
                    message: "Invalid Google Ads settings payload.",
                });
            }
        }
    );
}
