import { CarbonEdition, DOMAIN } from "@carbon/auth";
import { Edition } from "@carbon/utils";
import * as cookie from "cookie";

const cookieName = "companyId";
const isTestEdition = CarbonEdition === Edition.Test;

/** Set-Cookie Domain must be a hostname without a port; `cookie` rejects values like `localhost:3000`. */
function companyCookieDomain(): string | undefined {
  if (isTestEdition || !DOMAIN) return undefined;
  if (DOMAIN.startsWith("localhost")) return undefined;
  if (DOMAIN.includes(":")) return undefined;
  return DOMAIN;
}

export function setCompanyId(companyId: string | null) {
  const domain = companyCookieDomain();

  if (!companyId) {
    return cookie.serialize(cookieName, "", {
      path: "/",
      expires: new Date(0),
      domain
    });
  }

  return cookie.serialize(cookieName, companyId, {
    path: "/",
    maxAge: 31536000, // 1 year
    domain
  });
}
