import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
  const safePath = typeof path === "string" ? path.replace(/^\/+/, "") : "";
  const url = `https://queue-times.com/${safePath}`;

  try {
    const response = await fetch(url, {
      headers: {
        // Queue-Times may block datacenter UAs; use a browser-like header set.
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    res.setHeader("Content-Type", contentType || "application/json; charset=utf-8");

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      res.status(response.status).send(text || JSON.stringify({ error: "Upstream error", status: response.status }));
      return;
    }

    // Prefer JSON. If a .json endpoint returns HTML (common when blocked), surface a 502 JSON error
    // so the client doesn't crash on response.json().
    if (contentType.includes("application/json")) {
      const data = await response.json();
      res.status(200).json(data);
      return;
    }

    const text = await response.text().catch(() => "");
    if (safePath.endsWith(".json")) {
      res.status(502).json({
        error: "Upstream did not return JSON",
        upstreamStatus: response.status,
        contentType,
        snippet: text.slice(0, 200),
      });
      return;
    }

    res.status(200).send(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Proxy fetch failed", message });
  }
}

