const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PML 2 Telemetry</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{margin:0;background:#071014;color:#e9f4f4}
main{max-width:1180px;margin:auto;padding:32px 20px 48px}
header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:28px}
h1{margin:0;font-size:30px;letter-spacing:-.03em}
.sub{color:#8ca7aa;margin-top:6px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.card,.panel{background:#0d1a1f;border:1px solid #193139;border-radius:16px}
.card{padding:20px}
.label{font-size:13px;color:#8ca7aa}
.value{font-size:34px;font-weight:700;margin-top:8px}
.panel{padding:20px;margin-top:14px}
.panel h2{font-size:16px;margin:0 0 16px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.row{display:grid;grid-template-columns:90px 1fr 64px;align-items:center;gap:12px;margin:10px 0;font-size:13px}
.bar{height:8px;background:#173139;border-radius:99px;overflow:hidden}
.fill{height:100%;background:#36c7c0;border-radius:99px}
.day{display:grid;grid-template-columns:repeat(30,1fr);align-items:end;height:150px;gap:4px}
.day i{display:block;min-height:2px;background:#36c7c0;border-radius:4px 4px 0 0}
.legend{display:flex;justify-content:space-between;color:#668388;font-size:11px;margin-top:7px}
.status{font-size:12px;color:#668388}
.error{color:#ff8d8d}
@media(max-width:760px){.grid,.two{grid-template-columns:1fr}header{display:block}.day{gap:2px}}
</style>
</head>
<body>
<main>
<header><div><h1>PML 2 Telemetry</h1><div class="sub">Anonymous active-installation analytics</div></div><div id="status" class="status">Loading…</div></header>
<section class="grid">
<div class="card"><div class="label">DAU</div><div id="dau" class="value">—</div></div>
<div class="card"><div class="label">WAU</div><div id="wau" class="value">—</div></div>
<div class="card"><div class="label">MAU</div><div id="mau" class="value">—</div></div>
</section>
<section class="panel"><h2>Daily active installations · 30 days</h2><div id="days" class="day"></div><div class="legend"><span id="from"></span><span>Today</span></div></section>
<section class="two">
<div class="panel"><h2>Versions · 30 days</h2><div id="versions"></div></div>
<div class="panel"><h2>Platforms · 30 days</h2><div id="platforms"></div></div>
</section>
<script>
const fmt=n=>new Intl.NumberFormat().format(n||0);
const renderRows=(el,rows)=>{const max=Math.max(1,...rows.map(x=>Number(x.count)||0));el.innerHTML=rows.length?rows.map(x=>`<div class="row"><span>${esc(x.name)}</span><div class="bar"><div class="fill" style="width:${(Number(x.count)/max*100).toFixed(1)}%"></div></div><strong>${fmt(x.count)}</strong></div>`).join(""):"<div class='status'>No data yet</div>"};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function load(){
 try{
  const r=await fetch("/api/dashboard",{cache:"no-store"});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const d=await r.json();
  dau.textContent=fmt(d.dau); wau.textContent=fmt(d.wau); mau.textContent=fmt(d.mau);
  renderRows(versions,d.versions); renderRows(platforms,d.platforms);
  const vals=d.daily.map(x=>Number(x.count)||0), max=Math.max(1,...vals);
  days.innerHTML=d.daily.map(x=>`<i title="${x.date}: ${fmt(x.count)}" style="height:${Math.max(2,Number(x.count)/max*100)}%"></i>`).join("");
  from.textContent=d.daily[0]?.date||"";
  status.textContent="Updated "+new Date().toLocaleTimeString();
 }catch(e){status.textContent=e.message;status.className="status error"}
}
load(); setInterval(load,60000);
</script>
</main>
</body>
</html>`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="PML 2 Telemetry"',
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(request, env) {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Basic ") || !env.DASHBOARD_USER || !env.DASHBOARD_PASSWORD) {
    return false;
  }
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return decoded.slice(0, separator) === env.DASHBOARD_USER &&
      decoded.slice(separator + 1) === env.DASHBOARD_PASSWORD;
  } catch {
    return false;
  }
}

async function query(env, sql, params) {
  const result = await env.ANALYTICS_SQL.query({ query: sql, params });
  return result.data ?? [];
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
        version: 2,
      });
    }

    if (request.method === "GET" && url.pathname === "/dashboard") {
      if (!isAuthorized(request, env)) return unauthorized();
      return new Response(DASHBOARD_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard") {
      if (!isAuthorized(request, env)) return unauthorized();

      try {
        const now = new Date();
        const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [dau, wau, mau, versions, platforms, daily] = await Promise.all([
          query(env, `SELECT uniqExact(index1) AS count FROM events.analyticsEngine."pml2_telemetry" WHERE timestamp >= $start`, { start: start24h }),
          query(env, `SELECT uniqExact(index1) AS count FROM events.analyticsEngine."pml2_telemetry" WHERE timestamp >= $start`, { start: start7d }),
          query(env, `SELECT uniqExact(index1) AS count FROM events.analyticsEngine."pml2_telemetry" WHERE timestamp >= $start`, { start: start30d }),
          query(env, `SELECT blob2 AS name, uniqExact(index1) AS count FROM events.analyticsEngine."pml2_telemetry" WHERE timestamp >= $start GROUP BY blob2 ORDER BY count DESC LIMIT 12`, { start: start30d }),
          query(env, `SELECT blob3 AS name, uniqExact(index1) AS count FROM events.analyticsEngine."pml2_telemetry" WHERE timestamp >= $start GROUP BY blob3 ORDER BY count DESC LIMIT 8`, { start: start30d }),
          query(env, `SELECT toDate(timestamp) AS date, uniqExact(index1) AS count FROM events.analyticsEngine."pml2_telemetry" WHERE timestamp >= $start GROUP BY date ORDER BY date ASC`, { start: start30d }),
        ]);

        return json({
          dau: dau[0]?.count ?? 0,
          wau: wau[0]?.count ?? 0,
          mau: mau[0]?.count ?? 0,
          versions,
          platforms,
          daily,
        });
      } catch (error) {
        console.error("dashboard query failed", error);
        return json({ error: "dashboard_query_failed" }, 500);
      }
    }

    if (request.method !== "POST" || url.pathname !== "/v1/event") {
      return json({ error: "not_found" }, 404);
    }

    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (contentLength > 16 * 1024) return json({ error: "payload_too_large" }, 413);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const event = typeof body.event === "string" ? body.event : "";
    const installationId = typeof body.installation_id === "string" ? body.installation_id : "";
    const version = typeof body.version === "string" ? body.version : "";
    const platform = typeof body.platform === "string" ? body.platform : "";
    const architecture = typeof body.architecture === "string" ? body.architecture : "";

    if (!event || !installationId || !version || !platform || !architecture) {
      return json({ error: "missing_fields" }, 400);
    }

    if (event.length > 64 || installationId.length > 128 || version.length > 64 || platform.length > 32 || architecture.length > 32) {
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
