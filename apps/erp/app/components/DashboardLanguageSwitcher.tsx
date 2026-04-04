import { Trans } from "@lingui/react/macro";
import { Form, useLocation } from "react-router";
import { type LinguiLocale, linguiLocales } from "~/utils/lingui-locale";

const labels: Record<LinguiLocale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  fr: "Français"
};

export function DashboardLanguageSwitcher({
  active
}: {
  active: LinguiLocale;
}) {
  const { pathname, search } = useLocation();
  const redirectTo = `${pathname}${search}`;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
      <span className="text-sm font-medium text-muted-foreground">
        <Trans id="dashboard.language">Language</Trans>
      </span>
      <Form action="/" className="flex flex-wrap gap-1.5" method="post">
        <input name="intent" type="hidden" value="setLocale" />
        <input name="redirectTo" type="hidden" value={redirectTo} />
        {linguiLocales.map((code) => (
          <button
            key={code}
            className={
              code === active
                ? "rounded-md border border-primary bg-primary px-2.5 py-1 text-sm text-primary-foreground"
                : "rounded-md border border-border bg-card px-2.5 py-1 text-sm text-foreground hover:bg-accent"
            }
            name="locale"
            type="submit"
            value={code}
          >
            {labels[code]}
          </button>
        ))}
      </Form>
    </div>
  );
}
