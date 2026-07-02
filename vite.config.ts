import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { IncomingMessage, ServerResponse } from "http";

const createContentApiMiddleware = () => {
  const CONTENT_DIR = path.resolve(__dirname, "public/content/pages");

  const ensureDir = async () => {
    await fsPromises.mkdir(CONTENT_DIR, { recursive: true });
  };

  const sanitizeSlug = (slug: string) =>
    slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const getFilePath = (slug: string) => path.join(CONTENT_DIR, `${slug}.md`);

  const readBody = async (req: IncomingMessage) =>
    await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url || !req.url.startsWith("/api/content/pages")) {
      return next();
    }

    try {
      await ensureDir();
      const url = new URL(req.url, "http://localhost");
      const slugFromPath = url.pathname.replace("/api/content/pages", "").replace(/^\//, "");

      if (req.method === "GET") {
        if (!slugFromPath) {
          res.statusCode = 400;
          res.end("Slug is required");
          return;
        }

        const filePath = getFilePath(sanitizeSlug(slugFromPath));
        try {
          const content = await fsPromises.readFile(filePath, "utf-8");
          res.setHeader("Content-Type", "text/markdown");
          res.end(content);
        } catch (error: unknown) {
          const err = error as NodeJS.ErrnoException;
          res.statusCode = err?.code === "ENOENT" ? 404 : 500;
          res.end(err?.code === "ENOENT" ? "Markdown file not found" : "Failed to read markdown file");
        }
        return;
      }

      if (req.method === "POST") {
        const rawBody = await readBody(req);
        let payload: Record<string, unknown> = {};
        if (rawBody) {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        }
        const slugInput = typeof payload.slug === "string" ? payload.slug : "";
        const slug = sanitizeSlug(slugInput);
        if (!slug) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid slug" }));
          return;
        }
        const filePath = getFilePath(slug);
        if (fs.existsSync(filePath)) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: "Markdown file already exists" }));
          return;
        }
        const content =
          typeof payload.content === "string"
            ? payload.content
            : `# ${typeof payload.title === "string" ? payload.title : slug}\n\nStart writing here...`;
        await fsPromises.writeFile(filePath, content, "utf-8");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ slug }));
        return;
      }

      if (req.method === "PUT") {
        if (!slugFromPath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Slug is required" }));
          return;
        }
        const slug = sanitizeSlug(slugFromPath);
        const filePath = getFilePath(slug);
        const rawBody = await readBody(req);
        const payload = (rawBody ? JSON.parse(rawBody) : {}) as Record<string, unknown>;
        if (typeof payload.content !== "string") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "content is required" }));
          return;
        }
        await fsPromises.writeFile(filePath, payload.content, "utf-8");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ slug }));
        return;
      }

      if (req.method === "DELETE") {
        if (!slugFromPath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Slug is required" }));
          return;
        }
        const slug = sanitizeSlug(slugFromPath);
        const filePath = getFilePath(slug);
        try {
          await fsPromises.unlink(filePath);
        } catch (error: unknown) {
          const err = error as NodeJS.ErrnoException;
          if (err?.code !== "ENOENT") {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Failed to delete markdown file" }));
            return;
          }
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ slug }));
        return;
      }

      res.statusCode = 405;
      res.end("Method not allowed");
    } catch (error: unknown) {
      res.statusCode = 500;
      const message = error instanceof Error ? error.message : "Content API error";
      res.end(message);
    }
  };
};

const contentApiPlugin = () => ({
  name: "local-content-api",
  configureServer(server) {
    server.middlewares.use(createContentApiMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(createContentApiMiddleware());
  },
});

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), contentApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
