"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChannelMessage } from "@/lib/types";
import { setLang as persistLang, useLang } from "@/lib/lang";

type AuthStatus = {
  hasPassword: boolean;
  authorized: boolean;
};

const COPY = {
  zh: {
    channel: "\u901A\u9053",
    donate: "\u6253\u8D4F",
    copy: "\u590D\u5236",
    copied: "\u5DF2\u590D\u5236",
    passwordHint: "\u5BC6\u7801\u4EC5\u7528\u4E8E\u524D\u7AEF\u8BBF\u95EE\uFF0C\u4E0E Agent \u901A\u9053\u65E0\u5173\u3002",
    agentGuideLabel: "Agent 接入说明",
    agentGuideExpand: "展开",
    agentGuideCollapse: "收起",
    agentGuideIntro: "告诉你的 Agent：",
    agentGuideText:
      "安装 automatic，按 https://tool.auto.txzy.net/SKILL.md 操作，并设置 AUTOMATIC_CHANNEL_IDS=<channel id>。",
    noPassword: "\u5F53\u524D\u672A\u8BBE\u7F6E\u5BC6\u7801\uFF08\u9ED8\u8BA4\u5F00\u653E\uFF09\uFF0C\u53EF\u9009\u8BBE\u7F6E\uFF1A",
    setPasswordPlaceholder: "\u8BBE\u7F6E\u623F\u95F4\u5BC6\u7801\uFF084-64\uFF09",
    setPassword: "\u8BBE\u7F6E\u5BC6\u7801",
    locked: "\u623F\u95F4\u5DF2\u52A0\u5BC6\uFF0C\u8BF7\u8F93\u5165\u5BC6\u7801\u767B\u5F55\u3002",
    inputPassword: "\u8F93\u5165\u623F\u95F4\u5BC6\u7801",
    login: "\u767B\u5F55\u623F\u95F4",
    authed: "\u5DF2\u901A\u8FC7\u623F\u95F4\u5BC6\u7801\u9A8C\u8BC1\u3002",
    logout: "\u9000\u51FA\u767B\u5F55",
    sendError: "\u53D1\u9001\u5931\u8D25",
    setPasswordError: "\u8BBE\u7F6E\u5BC6\u7801\u5931\u8D25",
    loginError: "\u767B\u5F55\u5931\u8D25",
    realtime: "\u5B9E\u65F6\u72B6\u6001",
    sse: "SSE \u5DF2\u8FDE\u63A5",
    polling: "\u8F6E\u8BE2\u5E95\u5C42\u4E2D",
    empty: "\u8FD8\u6CA1\u6709\u6D88\u606F\uFF0C\u5148\u53D1\u4E00\u6761\u8BD5\u8BD5\u3002",
    inputMsg: "\u8F93\u5165\u6D88\u606F...",
    needAuth: "\u8BF7\u5148\u901A\u8FC7\u623F\u95F4\u9A8C\u8BC1",
    send: "\u53D1\u9001",
  },
  en: {
    channel: "Channel",
    donate: "Tip",
    copy: "Copy",
    copied: "Copied",
    passwordHint: "Password is for front-end access only and is unrelated to Agent channel.",
    agentGuideLabel: "Agent setup",
    agentGuideExpand: "Show",
    agentGuideCollapse: "Hide",
    agentGuideIntro: "Tell your Agent:",
    agentGuideText:
      "Install automatic, follow https://tool.auto.txzy.net/SKILL.md, and set AUTOMATIC_CHANNEL_IDS=<channel id>.",
    noPassword: "No room password now (default open). Optional setup:",
    setPasswordPlaceholder: "Set room password (4-64)",
    setPassword: "Set Password",
    locked: "This room is locked. Enter password to continue.",
    inputPassword: "Enter room password",
    login: "Login",
    authed: "Room password verified.",
    logout: "Logout",
    sendError: "Send failed",
    setPasswordError: "Set password failed",
    loginError: "Login failed",
    realtime: "Realtime",
    sse: "SSE connected",
    polling: "Polling fallback",
    empty: "No messages yet, send one to start.",
    inputMsg: "Type a message...",
    needAuth: "Pass room auth first",
    send: "Send",
  },
} as const;

function sortAndDedupe(messages: ChannelMessage[]): ChannelMessage[] {
  const map = new Map<number, ChannelMessage>();
  for (const m of messages) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

export default function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId: rawChannelId } = use(params);
  const channelId = rawChannelId ?? "";
  const [auth, setAuth] = useState<AuthStatus>({ hasPassword: false, authorized: true });
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showAgentGuide, setShowAgentGuide] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const lang = useLang();
  const lastIdRef = useRef(0);

  const canChat = useMemo(
    () => channelId.length > 0 && (!auth.hasPassword || auth.authorized),
    [channelId, auth],
  );
  const copy = COPY[lang];
  const agentGuideText = useMemo(
    () =>
      copy.agentGuideText.replace("<channel id>", channelId || "<channel id>"),
    [channelId, copy.agentGuideText],
  );
  const agentGuideCopy = useMemo(
    () => agentGuideText,
    [agentGuideText],
  );

  const refreshStatus = useCallback(async () => {
    if (!channelId) return;
    const resp = await fetch(`/api/channels/${channelId}/auth/status`, {
      cache: "no-store",
    });
    if (!resp.ok) return;
    const data = (await resp.json()) as AuthStatus;
    setAuth({ hasPassword: data.hasPassword, authorized: data.authorized });
  }, [channelId]);

  const loadAllMessages = useCallback(async () => {
    if (!canChat) return;
    const resp = await fetch(
      `/api/channels/${channelId}/messages?role=all&since_id=0`,
      { cache: "no-store" },
    );
    if (!resp.ok) return;
    const data = (await resp.json()) as { messages: ChannelMessage[] };
    const full = sortAndDedupe(data.messages);
    setMessages(full);
    lastIdRef.current = full.length ? full[full.length - 1].id : 0;
  }, [canChat, channelId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    loadAllMessages();
  }, [loadAllMessages]);

  const messagesRef = useRef<ChannelMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!canChat) return;

    const source = new EventSource(`/api/channels/${channelId}/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => {
      setConnected(false);
      source.close();
    };
    source.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as { message: ChannelMessage };
        const next = sortAndDedupe([...messagesRef.current, data.message]);
        messagesRef.current = next;
        setMessages(next);
        lastIdRef.current = next[next.length - 1]?.id ?? lastIdRef.current;
      } catch {
        // ignore malformed event
      }
    });

    return () => source.close();
  }, [canChat, channelId]);

  useEffect(() => {
    if (!canChat || connected) return;
    const timer = setInterval(async () => {
      const resp = await fetch(
        `/api/channels/${channelId}/messages?role=all&since_id=${lastIdRef.current}`,
        { cache: "no-store" },
      );
      if (!resp.ok) return;
      const data = (await resp.json()) as { messages: ChannelMessage[] };
      if (!data.messages.length) return;
      const next = sortAndDedupe([...messagesRef.current, ...data.messages]);
      messagesRef.current = next;
      setMessages(next);
      lastIdRef.current = next[next.length - 1]?.id ?? lastIdRef.current;
    }, 1500);
    return () => clearInterval(timer);
  }, [canChat, channelId, connected]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/channels/${channelId}/user-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? copy.sendError);
        return;
      }
      const next = sortAndDedupe([...messagesRef.current, data.message as ChannelMessage]);
      setMessages(next);
      setContent("");
    } finally {
      setLoading(false);
    }
  };

  const setRoomPassword = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/channels/${channelId}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? copy.setPasswordError);
        return;
      }
      setNewPassword("");
      setAuth({ hasPassword: true, authorized: true });
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/channels/${channelId}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? copy.loginError);
        return;
      }
      setPassword("");
      setAuth({ hasPassword: Boolean(data.hasPassword), authorized: Boolean(data.authorized) });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch(`/api/channels/${channelId}/auth/logout`, { method: "POST" });
    await refreshStatus();
  };

  const copyAgentGuide = async () => {
    if (!agentGuideCopy) return;
    try {
      await navigator.clipboard.writeText(agentGuideCopy);
      setCopiedGuide(true);
      window.setTimeout(() => setCopiedGuide(false), 1200);
    } catch {
      setCopiedGuide(false);
    }
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-[840px] flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-semibold tracking-tight sm:text-[20px]">
            txzy/tool/automatic
          </h1>
          <a
            href="https://buy.stripe.com/5kQ4gybHj2T26Rv1Jh2sM00"
            target="_blank"
            rel="noreferrer"
            className="border border-black bg-white px-3 py-1.5 text-[12px] font-semibold leading-none sm:text-[13px]"
          >
            {copy.donate}
          </a>
        </div>
        <div className="flex border border-black">
          <button
            onClick={() => {
              persistLang("zh");
            }}
            className={`border-r border-black px-3 py-1.5 text-[12px] font-semibold leading-none sm:px-4 sm:text-[13px] ${
              lang === "zh" ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            {"\u4E2D\u6587"}
          </button>
          <button
            onClick={() => {
              persistLang("en");
            }}
            className={`px-3 py-1.5 text-[12px] font-semibold leading-none sm:px-4 sm:text-[13px] ${
              lang === "en" ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      <section className="shrink-0 border border-black bg-white px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="text-[20px] font-semibold leading-tight sm:text-[24px]">
          {copy.channel} {channelId || "..."}
        </h2>
        <p className="mt-1.5 text-[13px] leading-5 text-zinc-800 sm:text-[14px]">
          {copy.passwordHint}
        </p>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAgentGuide((current) => !current)}
            aria-expanded={showAgentGuide}
            className="border border-black bg-white px-3 py-1.5 text-[12px] font-semibold leading-none sm:text-[13px]"
          >
            {showAgentGuide ? copy.agentGuideCollapse : copy.agentGuideExpand} {copy.agentGuideLabel}
          </button>

          {showAgentGuide && (
            <div className="mt-2 border border-black bg-zinc-50 px-3 py-2 text-[13px] leading-5 text-zinc-800 sm:text-[14px]">
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 whitespace-normal">
                  {copy.agentGuideIntro} {agentGuideText}
                </p>
                <button
                  type="button"
                  onClick={copyAgentGuide}
                  className="shrink-0 border border-black bg-white px-3 py-1 text-[12px] font-semibold leading-none"
                >
                  {copiedGuide ? copy.copied : copy.copy}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 border border-black p-3 sm:p-4">
          {!auth.hasPassword && (
            <div className="space-y-2">
              <p className="text-[13px] sm:text-[14px]">{copy.noPassword}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  placeholder={copy.setPasswordPlaceholder}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 border border-black px-3 py-2 text-[13px] outline-none placeholder:text-zinc-400 sm:text-[14px]"
                />
                <button
                  onClick={setRoomPassword}
                  disabled={loading || newPassword.length < 4}
                  className="bg-black px-4 py-2 text-[13px] font-semibold text-white disabled:bg-zinc-400 sm:text-[14px]"
                >
                  {copy.setPassword}
                </button>
              </div>
            </div>
          )}

          {auth.hasPassword && !auth.authorized && (
            <div className="space-y-2">
              <p className="text-[13px] sm:text-[14px]">{copy.locked}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  placeholder={copy.inputPassword}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 border border-black px-3 py-2 text-[13px] outline-none placeholder:text-zinc-400 sm:text-[14px]"
                />
                <button
                  onClick={login}
                  disabled={loading || !password}
                  className="bg-black px-4 py-2 text-[13px] font-semibold text-white disabled:bg-zinc-400 sm:text-[14px]"
                >
                  {copy.login}
                </button>
              </div>
            </div>
          )}

          {auth.hasPassword && auth.authorized && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] sm:text-[14px]">{copy.authed}</p>
              <button
                onClick={logout}
                className="border border-black px-3 py-1 text-[12px] sm:text-[13px]"
              >
                {copy.logout}
              </button>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] text-red-700 sm:text-[14px]">{error}</p>}
      </section>

      <section className="mt-3 flex min-h-0 flex-1 flex-col border border-black bg-white px-4 py-3 sm:px-5 sm:py-4">
        <p className="mb-2 shrink-0 text-[12px] sm:text-[13px]">
          {copy.realtime}：{connected ? copy.sse : copy.polling}
        </p>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto border border-black p-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`border px-3 py-2 ${
                m.sender === "user" ? "border-black bg-white" : "border-black bg-zinc-100"
              }`}
            >
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-700">
                {m.sender.toUpperCase()} 路 {new Date(m.timestamp).toLocaleTimeString()}
              </div>
              <div className="whitespace-pre-wrap break-words text-[13px] leading-5 sm:text-[14px] sm:leading-6">
                {m.content}
              </div>
            </div>
          ))}
          {!messages.length && (
            <p className="text-center text-[12px] text-zinc-500 sm:text-[13px]">
              {copy.empty}
            </p>
          )}
        </div>

        <form onSubmit={sendMessage} className="mt-3 flex shrink-0 gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!canChat || loading}
            placeholder={canChat ? copy.inputMsg : copy.needAuth}
            className="flex-1 border border-black px-3 py-2 text-[13px] outline-none placeholder:text-zinc-400 sm:text-[14px]"
          />
          <button
            type="submit"
            disabled={!canChat || loading || !content.trim()}
            className="bg-black px-4 py-2 text-[13px] font-semibold text-white disabled:bg-zinc-400 sm:text-[14px]"
          >
            {copy.send}
          </button>
        </form>
      </section>
    </main>
  );
}
