"use client";

import { useSyncExternalStore } from "react";

export type Lang = "zh" | "en";

const LANG_KEY = "automatic-lang";
const LANG_EVENT = "automatic-lang-change";

function readLang(): Lang {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem(LANG_KEY);
  return saved === "en" ? "en" : "zh";
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(LANG_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LANG_EVENT, handler);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, () => "zh");
}

export function setLang(next: Lang): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_KEY, next);
  window.dispatchEvent(new Event(LANG_EVENT));
}
