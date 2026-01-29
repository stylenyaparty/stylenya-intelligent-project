import "dotenv/config";
import { createApp } from "./app.js";

const app = await createApp({ logger: true });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

app.ready(() => {
    console.log(app.printRoutes());
});

await app.listen({ port, host });
