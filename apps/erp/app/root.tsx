import { CONTROLLED_ENVIRONMENT, error, getBrowserEnv } from "@carbon/auth";
import { getSessionFlash } from "@carbon/auth/session.server";
import { validator } from "@carbon/form";
import {
  Button,
  Heading,
  OperatingSystemContextProvider,
  Toaster,
  toast,
  useMount
} from "@carbon/react";
import { getPreferenceHeaders, useMode } from "@carbon/remix";
import type { Theme } from "@carbon/utils";
import { modeValidator, themes } from "@carbon/utils";
import type { Messages } from "@lingui/core";
import { setupI18n } from "@lingui/core";
import { I18nProvider as LinguiProvider } from "@lingui/react";
import { I18nProvider } from "@react-aria/i18n";
import { QueryClient } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import type React from "react";
import { useEffect, useMemo } from "react";
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction
} from "react-router";
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "react-router";
import SonnerStyle from "sonner/dist/styles.css?url";
import {
  getI18nLangFromCookie,
  setI18nLang
} from "~/services/i18n-lang.server";
import { getMode, setMode } from "~/services/mode.server";
import Background from "~/styles/background.css?url";
import NProgress from "~/styles/nprogress.css?url";
import Tailwind from "~/styles/tailwind.css?url";
import {
  ariaLocaleForLingui,
  isLinguiLocale,
  type LinguiLocale,
  toLinguiLocale
} from "~/utils/lingui-locale";
import { messages as messagesDe } from "../locales/de/messages.mjs";
import { messages as messagesEn } from "../locales/en/messages.mjs";
import { messages as messagesEs } from "../locales/es/messages.mjs";
import { messages as messagesFr } from "../locales/fr/messages.mjs";
import type { Route } from "./+types/root";
import "./polyfill";
import { getTheme } from "./services/theme.server";

const linguiCatalogs: Record<LinguiLocale, Messages> = {
  en: messagesEn,
  es: messagesEs,
  de: messagesDe,
  fr: messagesFr
};

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: Tailwind },
    { rel: "stylesheet", href: Background },
    { rel: "stylesheet", href: NProgress },
    { rel: "stylesheet", href: SonnerStyle }
  ];
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Carbon"
    }
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const {
    CARBON_EDITION,
    CARBON_API_URL,
    CLOUDFLARE_TURNSTILE_SITE_KEY,
    CONTROLLED_ENVIRONMENT,
    ERP_URL,
    GOOGLE_PLACES_API_KEY,
    JIRA_CLIENT_ID,
    MES_URL,
    NOVU_APPLICATION_ID,
    NOVU_API_URL,
    ONSHAPE_CLIENT_ID,
    POSTHOG_API_HOST,
    POSTHOG_PROJECT_PUBLIC_KEY,
    QUICKBOOKS_CLIENT_ID,
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
    VERCEL_ENV,
    VERCEL_URL,
    XERO_CLIENT_ID
  } = getBrowserEnv();

  const sessionFlash = await getSessionFlash(request);

  const basePrefs = getPreferenceHeaders(request);
  const fromCookie = getI18nLangFromCookie(request);
  let locale = basePrefs.locale;
  let linguiLocale: LinguiLocale = toLinguiLocale(basePrefs.locale);
  if (fromCookie) {
    linguiLocale = fromCookie;
    locale = ariaLocaleForLingui(fromCookie);
  }
  const preferences = { ...basePrefs, locale };

  return data(
    {
      env: {
        CARBON_EDITION,
        CARBON_API_URL,
        CLOUDFLARE_TURNSTILE_SITE_KEY,
        CONTROLLED_ENVIRONMENT,
        ERP_URL,
        GOOGLE_PLACES_API_KEY,
        JIRA_CLIENT_ID,
        MES_URL,
        NOVU_APPLICATION_ID,
        NOVU_API_URL,
        ONSHAPE_CLIENT_ID,
        POSTHOG_API_HOST,
        POSTHOG_PROJECT_PUBLIC_KEY,
        QUICKBOOKS_CLIENT_ID,
        SUPABASE_ANON_KEY,
        SUPABASE_URL,
        VERCEL_ENV,
        VERCEL_URL,
        XERO_CLIENT_ID
      },
      mode: getMode(request),
      theme: getTheme(request),
      preferences,
      linguiLocale,
      messages: linguiCatalogs[linguiLocale],
      result: sessionFlash?.result
    },
    {
      headers: sessionFlash?.headers
    }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  if (formData.get("intent") === "setLocale") {
    const locale = String(formData.get("locale") ?? "");
    if (!isLinguiLocale(locale)) {
      return data(error({}, "Invalid locale"), { status: 400 });
    }
    const redirectToRaw = formData.get("redirectTo");
    const redirectTo =
      typeof redirectToRaw === "string" && redirectToRaw.startsWith("/")
        ? redirectToRaw
        : "/";
    throw redirect(redirectTo, {
      headers: { "Set-Cookie": setI18nLang(locale) }
    });
  }

  const validation = await validator(modeValidator).validate(formData);

  if (validation.error) {
    return data(error(validation.error, "Invalid mode"), {
      status: 400
    });
  }

  return data(
    {},
    {
      headers: { "Set-Cookie": setMode(validation.data.mode) }
    }
  );
}

export function Document({
  children,
  title = "Carbon",
  mode = "light",
  theme = "zinc",
  htmlLang = "en"
}: {
  children: React.ReactNode;
  title?: string;
  mode?: "light" | "dark";
  theme?: string;
  /** BCP 47 language tag for `<html lang>`. */
  htmlLang?: string;
}) {
  const selectedTheme = themes.find((t) => t.name === theme) as
    | Theme
    | undefined;

  // Create style objects for both light and dark modes
  const lightVars: Record<string, string> = {};
  const darkVars: Record<string, string> = {};

  if (selectedTheme) {
    // Set light mode variables
    Object.entries(selectedTheme.cssVars.light).forEach(([key, value]) => {
      const cssKey = `--${key}`;
      lightVars[cssKey] = `${value}`;
    });

    // Set dark mode variables
    Object.entries(selectedTheme.cssVars.dark).forEach(([key, value]) => {
      const cssKey = `--${key}`;
      darkVars[cssKey] = `${value}`;
    });
  }

  // Combine the styles with proper selectors
  const themeStyle = {
    ...(mode === "light" ? lightVars : darkVars),
    "--radius": "0.675rem"
  } as React.CSSProperties;

  return (
    <html
      lang={htmlLang}
      className={`${mode} h-full overflow-x-hidden`}
      style={themeStyle}
    >
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <Meta />
        <title>{title}</title>
        <link rel="manifest" href="/site.webmanifest" />
        <Links />
      </head>
      <body className="h-full bg-background antialiased selection:bg-primary/10 selection:text-primary">
        {children}
        <Toaster position="bottom-right" visibleToasts={5} />
        <ScrollRestoration />
        <Scripts />
        {!CONTROLLED_ENVIRONMENT && <Analytics />}
      </body>
    </html>
  );
}

export default function App() {
  const loaderData = useLoaderData<typeof loader>();
  const env = loaderData?.env ?? {};
  const result = loaderData?.result;
  const theme = loaderData?.theme ?? "zinc";
  const prefs = loaderData.preferences;
  const linguiLocale = loaderData.linguiLocale;
  const messages = loaderData.messages;
  const mode = useMode();

  const lingui = useMemo(() => {
    const i18n = setupI18n();
    i18n.load(linguiLocale, messages);
    i18n.activate(linguiLocale);
    return i18n;
  }, [linguiLocale, messages]);

  useMount(() => {
    if (!window.clientCache) {
      window.clientCache = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            refetchOnWindowFocus: false,
            gcTime: Infinity
          }
        }
      });
    }
  });

  /* Toast Messages */
  useEffect(() => {
    if (result?.success === true) {
      toast.success(result.message);
    } else if (result?.message) {
      toast.error(result.message);
    }
  }, [result]);

  return (
    <OperatingSystemContextProvider platform={prefs.platform}>
      <LinguiProvider i18n={lingui}>
        <I18nProvider locale={prefs.locale}>
          <Document htmlLang={prefs.locale} mode={mode} theme={theme}>
            <Outlet />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.env = ${JSON.stringify(env)};`
              }}
            />
          </Document>
        </I18nProvider>
      </LinguiProvider>
    </OperatingSystemContextProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error)
    ? (error.data.message ?? error.data)
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <Document title="Error!">
      <div className="light">
        <div className="flex flex-col w-full h-screen items-center justify-center space-y-4 ">
          <img
            src="/carbon-logo-mark.svg"
            alt="Carbon Logo"
            className="block max-w-[60px]"
          />
          <Heading size="h1">Something went wrong</Heading>
          <p className="text-muted-foreground max-w-2xl">{message}</p>
          <Button onClick={() => (window.location.href = "/")}>
            Back Home
          </Button>
        </div>
      </div>
    </Document>
  );
}
