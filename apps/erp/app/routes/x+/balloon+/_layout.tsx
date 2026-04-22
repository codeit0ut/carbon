import { requirePermissions } from "@carbon/auth/auth.server";
import { VStack } from "@carbon/react";
import { msg } from "@lingui/core/macro";
import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useLocation } from "react-router";
import { getBalloonDocuments } from "~/modules/quality";
import { BalloonDocumentTable } from "~/modules/quality/ui/BalloonDocument";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";
import { getGenericQueryFilters } from "~/utils/query";

export const handle: Handle = {
  breadcrumb: msg`Balloon Documents`,
  to: path.to.balloonDocuments,
  module: "quality"
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    view: "quality",
    role: "employee"
  });

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const search = searchParams.get("search");
  const { limit, offset, sorts, filters } =
    getGenericQueryFilters(searchParams);

  const diagrams = await getBalloonDocuments(client, companyId, {
    search,
    limit,
    offset,
    sorts,
    filters
  });

  return {
    diagrams: diagrams.data ?? [],
    count: diagrams.count ?? 0
  };
}

export default function BalloonRoute() {
  const { diagrams, count } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const basePath = path.to.balloonDocuments;
  const suffix = pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length + 1)
    : "";
  const isDocumentDetail = suffix.length > 0 && !suffix.includes("/");

  if (isDocumentDetail) {
    return <Outlet />;
  }

  return (
    <VStack spacing={0} className="h-full">
      <BalloonDocumentTable data={diagrams} count={count} />
      <Outlet />
    </VStack>
  );
}
