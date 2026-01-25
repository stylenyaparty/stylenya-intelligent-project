import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await registerRoutes(app);

const PORT = Number(process.env.PORT ?? 3001);

app.listen({ port: PORT, host: "0.0.0.0" })
    .then(() => app.log.info(`API running on port ${PORT}`))
    .catch((err) => {
        app.log.error(err);
        process.exit(1);
    });
