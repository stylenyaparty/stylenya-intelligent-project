import { runResearchPipeline } from "../research/research.pipeline.js";
import { researchOutputSchema } from "../research/research.output.schema.js"; 
import { webResearchFlow } from "../genkit/flow.webResearch.js";
import "dotenv/config";

async function main() {
    const input = {
        prompt: "baby shower balloon garland neutral theme",
        mode: "deep" as const,
        market: "US",
        language: "en",
        topic: "product" as const,
    };

    const result = await runResearchPipeline(input);
    // const result = await webResearchFlow(input);

    // Hard assert: si no cumple schema, revienta aquí
    const parsed = researchOutputSchema.parse(result);
    console.log(
        "unique clusters:",
        [...new Set(parsed.rows.map((r) => r.cluster))]
    );
    console.log("OK ✅");
    console.log("rows:", parsed.rows.length);
    console.log("clusterBundles:", parsed.clusterBundles.length);
    console.log("resultBundle.title:", parsed.resultBundle?.title);
}

main().catch((e) => {
    const msg =
        e instanceof Error
            ? `${e.name}: ${e.message}\n${e.stack ?? ""}`
            : `Non-Error thrown: ${String(e)}`;

    console.error("FAILED ❌", msg);
    process.exit(1);
});