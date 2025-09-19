import { Router } from "express";
import { spawn } from "child_process";

export const customRouter = Router();

/** POST /api/custom/clone { slug, domain } */
customRouter.post("/clone", (req, res) => {
  const { slug, domain } = req.body || {};
  const script = process.env.CLONE_SCRIPT || "/opt/sites/clone.sh";

  if (!slug || !domain) {
    return res.status(400).json({ ok: false, error: "slug e domain são obrigatórios" });
  }
  // safety bem simples: só permitimos script em /opt/sites/
  if (!script.startsWith("/opt/sites/")) {
    return res.status(400).json({ ok: false, error: "script não permitido" });
  }

  const child = spawn(script, [slug, domain], { env: { ...process.env } });

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Transfer-Encoding": "chunked",
  });

  child.stdout.on("data", d => res.write(d));
  child.stderr.on("data", d => res.write(d));
  child.on("close", code => {
    res.write(`\n[done] exit=${code}\n`);
    res.end();
  });
});
