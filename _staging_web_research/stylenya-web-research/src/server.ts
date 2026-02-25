import dotenv from "dotenv";
dotenv.config();

import "dotenv/config";

import { buildApp } from "./app.js";

const app = buildApp();

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST ?? "0.0.0.0";

try {
    const address = await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server running at ${address}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}