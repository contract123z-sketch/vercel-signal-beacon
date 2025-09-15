// Vercel Serverless Function
// Route: /api/signal/<PAYLOAD>.gif  (captures any payload, even with dots or slashes)

const GIF_1X1 = Buffer.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,
  255,255,255,33,249,4,1,0,0,1,0,44,0,0,0,
  0,1,0,1,0,0,2,2,68,1,0,59
]);

// optional: set to true if you want to enforce HMAC signatures like: <payload>~<sig>
const REQUIRE_HMAC = false;

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(new Uint8Array(mac));
}

export default async function handler(req, res) {
  try {
    // Extract payload from dynamic catch-all
    // e.g. /api/signal/hello.gif  or /api/signal/meet-9pm.gif
    const parts = (req.query.p || []);
    if (parts.length === 0) return pixel(res); // fallback pixel

    // last path segment may end with .gif — strip it
    let raw = decodeURIComponent(parts.join("/"));
    if (raw.toLowerCase().endsWith(".gif")) raw = raw.slice(0, -4);

    // Optional HMAC format: <payload>~<sig>
    let payload = raw, valid = true;
    const secret = process.env.SIGNAL_SECRET || "";
    if (REQUIRE_HMAC && raw.includes("~")) {
      const [p, sig] = raw.split("~");
      const calc = await hmac(secret, p);
      valid = (sig === calc);
      payload = p;
      if (!valid) return pixel(res, 403);
    }

    // Post to ntfy (set NTFY_URL in Vercel Project → Settings → Environment Variables)
    const ntfy = process.env.NTFY_URL; // e.g. https://ntfy.sh/your-topic
    if (ntfy) {
      await fetch(ntfy, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: `img-view: ${payload} @ ${new Date().toISOString()}`
      });
    }

    return pixel(res);
  } catch (e) {
    return pixel(res); // fail closed with a pixel
  }
}

function pixel(res, status = 200) {
  res.status(status);
  res.setHeader("content-type", "image/gif");
  res.setHeader("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("pragma", "no-cache");
  res.setHeader("expires", "0");
  res.send(GIF_1X1);
}
