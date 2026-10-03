const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        service: "PML 2 Telemetry",
        status: "ok",
        version: 1,
      });
    }

    if (request.method !== "POST" || url.pathname !== "/v1/event") {
      return json({ error: "not_found" }, 404);
    }

    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (contentLength > 16 * 1024) {
      return json({ error: "payload_too_large" }, 413);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const event = typeof body.event === "string" ? body.event : "";
    const installationId =
      typeof body.installation_id === "string" ? body.installation_id : "";
    const version = typeof body.version === "string" ? body.version : "";
    const platform = typeof body.platform === "string" ? body.platform : "";
    const architecture =
      typeof body.architecture === "string" ? body.architecture : "";

    if (!event || !installationId || !version || !platform || !architecture) {
      return json({ error: "missing_fields" }, 400);
    }

    if (
      event.length > 64 ||
      installationId.length > 128 ||
      version.length > 64 ||
      platform.length > 32 ||
      architecture.length > 32
    ) {
      return json({ error: "field_too_long" }, 400);
    }

    await env.PML2_TELEMETRY.writeDataPoint({
      indexes: [installationId],
      blobs: [event, version, platform, architecture],
      doubles: [],
    });

    return json({ ok: true });
  },
};
