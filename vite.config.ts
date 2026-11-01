import { defineConfig, loadEnv } from "vite";
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

  const parseJsonBody = async (req: IncomingMessage) => {
    const rawBody = await readBody(req);
    return (rawBody ? JSON.parse(rawBody) : {}) as Record<string, unknown>;
  };

  const isLocalhostRequest = (req: IncomingMessage) => {
    const host = req.headers.host?.split(":")[0]?.toLowerCase() ?? "";
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  };

  const sendJson = (res: ServerResponse, payload: unknown, statusCode = 200) => {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };

  const stripCodeFences = (value: string) =>
    value
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

  const tryParseJson = (value: string) => {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const extractFirstJsonObject = (value: string) => {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return tryParseJson(value.slice(start, end + 1));
  };

  const extractResponsePayload = (data: Record<string, unknown>) => {
    const directOutputText = typeof data.output_text === "string" ? data.output_text : "";
    const directParsed =
      tryParseJson(stripCodeFences(directOutputText)) ??
      extractFirstJsonObject(stripCodeFences(directOutputText));
    if (directParsed) {
      return directParsed;
    }

    const outputItems = Array.isArray(data.output) ? data.output : [];
    for (const outputItem of outputItems) {
      if (!outputItem || typeof outputItem !== "object") continue;
      const contentItems = Array.isArray((outputItem as { content?: unknown }).content)
        ? ((outputItem as { content: unknown[] }).content)
        : [];

      for (const contentItem of contentItems) {
        if (!contentItem || typeof contentItem !== "object") continue;

        const maybeJson = (contentItem as { json?: unknown }).json;
        if (maybeJson && typeof maybeJson === "object") {
          return maybeJson as Record<string, unknown>;
        }

        const maybeText = typeof (contentItem as { text?: unknown }).text === "string"
          ? ((contentItem as { text: string }).text)
          : "";
        const parsedText =
          tryParseJson(stripCodeFences(maybeText)) ??
          extractFirstJsonObject(stripCodeFences(maybeText));
        if (parsedText) {
          return parsedText;
        }
      }
    }

    return null;
  };

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url || (!req.url.startsWith("/api/content/pages") && !req.url.startsWith("/api/ai/lesson-teaser"))) {
      return next();
    }

    try {
      const url = new URL(req.url, "http://localhost");

      if (url.pathname === "/api/ai/lesson-teaser") {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        if (!isLocalhostRequest(req)) {
          sendJson(res, { error: "AI generation is available only on localhost." }, 403);
          return;
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          sendJson(res, { error: "OPENAI_API_KEY is not set." }, 500);
          return;
        }

        const payload = await parseJsonBody(req);
        const title = typeof payload.title === "string" ? payload.title : "Lesson teaser";
        const sourceType = typeof payload.sourceType === "string" ? payload.sourceType : "lesson";
        const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
        const sourceContent = typeof payload.sourceContent === "string" ? payload.sourceContent : "";
        const slides = Array.isArray(payload.slides) ? payload.slides : [];
        const model = process.env.OPENAI_MODEL || "gpt-5";

        if (!prompt.trim()) {
          sendJson(res, { error: "Prompt is required." }, 400);
          return;
        }

        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            store: false,
            text: {
              format: {
                type: "json_schema",
                name: "lesson_teaser_payload",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    slides: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          id: { type: "string" },
                          title: { type: "string" },
                          subtitle: { type: "string" },
                          footer: { type: "string" },
                          bullets: {
                            type: "array",
                            items: { type: "string" },
                          },
                          boardTitle: { type: "string" },
                          boardNotes: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: ["id", "title", "subtitle", "footer", "bullets", "boardTitle", "boardNotes"],
                      },
                    },
                  },
                  required: ["slides"],
                },
              },
            },
            input: [
              {
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text:
                      "Return only structured data matching the schema. Do not impose your own design style. Follow the user's prompt for tone, visual direction, and copy decisions.",
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: JSON.stringify({
                      task: "Generate teaser slide copy and board notes from lesson content.",
                      title,
                      sourceType,
                      prompt,
                      sourceContent: sourceContent.slice(0, 14000),
                      slides,
                      required_shape: {
                        slides: [
                          {
                            id: "existing-slide-id",
                            title: "optional short title",
                            subtitle: "optional short subtitle",
                            footer: "optional short footer",
                            bullets: ["up to 5 short bullets"],
                            boardTitle: "optional board title block",
                            boardNotes: ["up to 3 short sticky-note texts"],
                          },
                        ],
                      },
                    }),
                  },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          const message = await response.text();
          sendJson(res, { error: message || "OpenAI request failed." }, 500);
          return;
        }

        const data = (await response.json()) as Record<string, unknown>;
        const rawText = typeof data.output_text === "string" ? data.output_text : JSON.stringify(data);
        const parsed = extractResponsePayload(data);
        if (!parsed) {
          sendJson(
            res,
            {
              error:
                "OpenAI returned a response that was not valid JSON. Adjust the prompt and try again.",
              raw: rawText,
            },
            502,
          );
          return;
        }
        sendJson(res, parsed);
        return;
      }

      await ensureDir();
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
        const payload = await parseJsonBody(req);
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
        const payload = await parseJsonBody(req);
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
      const message = error instanceof Error ? error.message : "Content API error";
      sendJson(res, { error: message }, 500);
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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
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
  };
});
