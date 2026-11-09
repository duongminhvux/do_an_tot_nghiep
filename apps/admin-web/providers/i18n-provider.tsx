"use client";
import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { resources } from "@/lib/i18n";

/** One locale-specific instance per render tree, shared consistently by SSR and hydration. */
export default function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams(),
    locale = params?.locale === "en" ? "en" : "vi";
  const instance = useMemo(() => {
    const value = createInstance();
    void value
      .use(initReactI18next)
      .init({
        resources,
        lng: locale,
        fallbackLng: "vi",
        defaultNS: "common",
        initAsync: false,
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
      });
    return value;
  }, [locale]);
  useEffect(() => {
    localStorage.setItem("i18nextLng", locale);
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
