"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setLang as persistLang, useLang } from "@/lib/lang";

const COPY = {
  zh: {
    heroTitle: "\u8FDB\u5165\u901A\u9053\u5F00\u59CB\u5BF9\u8BDD",
    heroDesc: "\u8F93\u5165 32 \u4F4D\u901A\u9053\u53F7\uFF0C\u6216\u751F\u6210\u4E00\u4E2A\u968F\u673A\u901A\u9053\u540E\u8FDB\u5165\u3002",
    sectionTitle: "\u5F00\u59CB\u804A\u5929",
    channelIdLabel: "\u901A\u9053 ID",
    channelIdPlaceholder: "\u4F8B\u5982 a3f9k2m7p9q1x8v4b6n0z5c7d2e8f1g9",
    generate: "\u751F\u6210 32 \u4F4D\u901A\u9053",
    enter: "\u8FDB\u5165\u901A\u9053",
  },
  en: {
    heroTitle: "Join A Channel",
    heroDesc: "Enter a 32-char channel ID, or generate one and start chatting.",
    sectionTitle: "Start chatting",
    channelIdLabel: "Channel ID",
    channelIdPlaceholder: "e.g. a3f9k2m7p9q1x8v4b6n0z5c7d2e8f1g9",
    generate: "Generate 32-char channel",
    enter: "Enter channel",
  },
} as const;

function randomChannelId(): string {
  const seed = crypto.randomUUID().replace(/-/g, "");
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    const index = parseInt(seed.slice(i, i + 1), 16) % chars.length;
    out += chars[index];
  }
  return out;
}

function normalizeChannelId(raw: string): string {
  return raw.trim().toLowerCase();
}

export default function Home() {
  const router = useRouter();
  const [channelId, setChannelId] = useState("");
  const lang = useLang();

  const valid = useMemo(
    () => /^[a-z0-9]{32}$/.test(normalizeChannelId(channelId)),
    [channelId],
  );
  const copy = COPY[lang];

  const switchLang = (next: "zh" | "en") => {
    persistLang(next);
  };

  const goRoom = () => {
    if (!valid) return;
    router.push(`/c/${normalizeChannelId(channelId)}`);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[840px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-[18px] font-semibold tracking-tight sm:text-[20px]">
          txzy/tool/automatic
        </h1>
        <div className="flex border border-black">
          <button
            onClick={() => switchLang("zh")}
            className={`border-r border-black px-3 py-1.5 text-[12px] font-semibold leading-none sm:px-4 sm:text-[13px] ${
              lang === "zh" ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            {"\u4E2D\u6587"}
          </button>
          <button
            onClick={() => switchLang("en")}
            className={`px-3 py-1.5 text-[12px] font-semibold leading-none sm:px-4 sm:text-[13px] ${
              lang === "en" ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      <section className="border border-black bg-white px-5 py-4 sm:px-6 sm:py-5">
        <h2 className="text-[24px] font-semibold leading-tight sm:text-[28px]">
          {copy.heroTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-zinc-800 sm:text-[15px]">
          {copy.heroDesc}
        </p>
      </section>

      <section className="mt-4 border border-black bg-white px-5 py-4 sm:mt-5 sm:px-6 sm:py-5">
        <h3 className="text-[18px] font-semibold sm:text-[20px]">{copy.sectionTitle}</h3>
        <label className="mt-3 block text-[13px] font-medium text-zinc-900 sm:text-[14px]">
          {copy.channelIdLabel}
        </label>
        <input
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder={copy.channelIdPlaceholder}
          className="mt-2 h-10 w-full border border-black px-3 text-[14px] outline-none placeholder:text-zinc-400 sm:text-[15px]"
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setChannelId(randomChannelId())}
            className="border border-black px-4 py-2 text-[14px] font-medium sm:text-[15px]"
          >
            {copy.generate}
          </button>
          <button
            onClick={goRoom}
            disabled={!valid}
            className="bg-black px-4 py-2 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400 sm:text-[15px]"
          >
            {copy.enter}
          </button>
        </div>
      </section>
    </main>
  );
}
