import { DOMAIN } from "@carbon/auth";
import * as cookie from "cookie";
import { isLinguiLocale, type LinguiLocale } from "~/utils/lingui-locale";

const cookieName = "i18n_lang";

export function getI18nLangFromCookie(request: Request): LinguiLocale | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  const value = cookie.parse(raw)[cookieName];
  if (typeof value !== "string" || !isLinguiLocale(value)) return null;
  return value;
}

export function setI18nLang(lang: LinguiLocale) {
  const cookieOptions: cookie.SerializeOptions = {
    path: "/",
    maxAge: 31_536_000,
    sameSite: "lax"
  };
  if (DOMAIN && !DOMAIN.startsWith("localhost")) {
    cookieOptions.domain = DOMAIN;
  }
  return cookie.serialize(cookieName, lang, cookieOptions);
}
