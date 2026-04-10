const JSON_HEADERS = { "Content-Type": "application/json" };

export function authHeaders(apiKey) {
  if (!apiKey) return JSON_HEADERS;
  return { ...JSON_HEADERS, Authorization: `Bearer ${apiKey}` };
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

export async function getAuthStatus(baseUrl, channelId) {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/auth/status`, { cache: "no-store" });
}

export async function getMessages(baseUrl, channelId, sinceId = 0, role = "all") {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/messages?role=${encodeURIComponent(role)}&since_id=${encodeURIComponent(sinceId)}`, {
    cache: "no-store",
  });
}

export async function postUserMessage(baseUrl, channelId, content) {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/user-message`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ content }),
  });
}

export async function postAgentMessage(baseUrl, channelId, content, apiKey = "") {
  return fetchJson(`${baseUrl}/api/channels/${channelId}/agent-message`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ content }),
  });
}
