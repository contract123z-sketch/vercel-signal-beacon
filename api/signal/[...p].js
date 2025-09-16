// Returns a fixed image every time, but still posts the payload to ntfy.
// Route: /api/signal/<PAYLOAD>.gif

const HARD_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg"; // <-- change me
const GIF_1X1 = Buffer.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,1,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);

let cachedImg = null;
let cachedType = "image/gif";

export default async function handler(req, res) {
  try {
    // 1) payload from path
    const parts = req.query.p || [];
    let raw = parts.join("/");
    if (raw.toLowerCase().endsWith(".gif")) raw = raw.slice(0, -4);
    const payload = raw ? decodeURIComponent(raw) : "empty";

    // 2) notify ntfy (payload only)
    const ntfy = process.env.NTFY_URL; // e.g. https://ntfy.sh/your-topic
    if (ntfy) {
      await fetch(ntfy, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: `img-view: ${payload} @ ${new Date().toISOString()}`
      });
    }

    // 3) serve the hardcoded image (fetched once & cached in memory)
    if (!cachedImg) {
      const r = await fetch(HARD_IMAGE_URL, { redirect: "follow" });
      if (!r.ok) throw new Error("hard image fetch failed");
      cachedType = r.headers.get("content-type") || "image/png";
      const arr = await r.arrayBuffer();
      cachedImg = Buffer.from(arr);
    }

    res.status(200);
    res.setHeader("content-type", cachedType);
    res.setHeader("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
    res.end(cachedImg);
  } catch {
    // fallback: 1×1 pixel
    res.status(200);
    res.setHeader("content-type", "image/gif");
    res.setHeader("cache-control", "no-store");
    res.end(GIF_1X1);
  }
}

