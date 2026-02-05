import type { FastifyReply, FastifyRequest } from "fastify";
import { isLegacyApiEnabled, isLegacyMutation } from "../../../modules/legacy/legacy-flags.js";

export async function requireLegacyEnabled(request: FastifyRequest, reply: FastifyReply) {
    const route = request.routeOptions?.url ?? request.url;
    request.log.info(`legacyRouteHit=true route=${route} method=${request.method}`);

    if (!isLegacyApiEnabled() && isLegacyMutation(request.method)) {
        return reply
            .code(410)
            .send({ error: "LEGACY_DISABLED", message: "Legacy feature disabled" });
    }
}
