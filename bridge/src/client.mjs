const JSON_HEADERS = { "Content-Type": "application/json" };

export function requestHeaders(cookie) {
  if (!cookie) return JSON_HEADERS;
  return { ...JSON_HEADERS, Cookie: cookie };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    const message = typeof parsed === "object" && parsed && "error" in parsed ? parsed.error : text || response.statusText;
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`);
  }
  return parsed;
}

function extractCookie(response) {
  const raw = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie()[0] : response.headers.get("set-cookie");
  if (!raw) return "";
  return raw.split(";")[0].trim();
}

export async function loginChannel(baseUrl, channelId, password) {
  const response = await fetch(`${baseUrl}/api/channels/${channelId}/auth/login`, {
    method: "POST",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify({ password }),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    const message = typeof parsed === "object" && parsed && "error" in parsed ? parsed.error : text || response.statusText;
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`);
  }
  const cookie = extractCookie(response);
  if (!cookie) {
    throw new Error("Login response missing session cookie");
  }
  return { ok: true, cookie, data: parsed };
}

export async function getAuthStatus(baseUrl, channelId, cookie = "") {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/auth/status`, {
    cache: "no-store",
    headers: requestHeaders(cookie),
  });
}

export async function getMessages(baseUrl, channelId, sinceId = 0, role = "all", cookie = "") {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/messages?role=${encodeURIComponent(role)}&since_id=${encodeURIComponent(sinceId)}`, {
    cache: "no-store",
    headers: requestHeaders(cookie),
  });
}

export async function postUserMessage(baseUrl, channelId, content) {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/user-message`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ content }),
  });
}

export async function postAgentMessage(baseUrl, channelId, content, cookie = "") {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/agent-message`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ content }),
  });
}
