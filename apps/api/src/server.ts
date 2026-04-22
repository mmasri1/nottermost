import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { initPrisma } from "./prisma.js";
import { authRouter } from "./routes/auth.js";
import { workspacesRouter } from "./routes/workspaces.js";
import { dmRouter } from "./routes/dm.js";
import { channelsRouter } from "./routes/channels.js";
import { createHttpServerWithWs } from "./ws/server.js";
import { ensureDevDbSchema } from "./startup/ensureDevDbSchema.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/workspaces", workspacesRouter);
app.use("/dm", dmRouter);
app.use("/channels", channelsRouter);

const server = createHttpServerWithWs(app);

async function main() {
  await ensureDevDbSchema();
  await initPrisma();
  server.listen(env.PORT, () => {
    console.log(`[api] listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

