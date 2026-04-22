import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { getCarbonServiceRole } from "@carbon/auth/client.server";
import { flash } from "@carbon/auth/session.server";
import { ClientOnly, Spinner } from "@carbon/react";
import { msg } from "@lingui/core/macro";
import { lazy, Suspense } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import {
  getBalloonAnchors,
  getBalloonDocument,
  getBalloons
} from "~/modules/quality";
import type { BalloonDocumentContent } from "~/modules/quality/types";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

const BalloonDocumentEditor = lazy(
  () => import("~/modules/quality/ui/BalloonDocument/BalloonDocumentEditor")
);

export const handle: Handle = {
  breadcrumb: (
    _params: unknown,
    data?: {
      diagram?: {
        name?: string | null;
        content?: { drawingNumber?: string | null } | null;
      };
    }
  ) =>
    data?.diagram?.name ??
    data?.diagram?.content?.drawingNumber ??
    msg`Balloon Document`,
  to: path.to.balloonDocuments,
  module: "quality"
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { companyId } = await requirePermissions(request, {
    view: "quality"
  });

  const { id } = params;
  if (!id) throw new Error("Could not find id");

  const serviceRole = await getCarbonServiceRole();
  const [diagram, selectors, balloons] = await Promise.all([
    getBalloonDocument(serviceRole, id),
    getBalloonAnchors(serviceRole, id),
    getBalloons(serviceRole, id)
  ]);

  if (diagram.error) {
    throw redirect(
      path.to.balloonDocuments,
      await flash(
        request,
        error(diagram.error, "Failed to load balloon document")
      )
    );
  }

  if (!diagram.data) {
    throw redirect(path.to.balloonDocuments);
  }

  if (diagram.data.companyId !== companyId) {
    throw redirect(path.to.balloonDocuments);
  }

  return {
    diagram: diagram.data,
    selectors: selectors.data ?? [],
    balloons: balloons.data ?? []
  };
}

export default function BalloonDetailRoute() {
  const { diagram, selectors, balloons } = useLoaderData<typeof loader>();
  const content = diagram.content as BalloonDocumentContent | null;

  return (
    <div className="flex flex-col h-[calc(100dvh-49px)] overflow-hidden w-full">
      <ClientOnly
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        }
      >
        {() => (
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <Spinner className="h-8 w-8" />
              </div>
            }
          >
            <BalloonDocumentEditor
              diagramId={diagram.id}
              name={diagram.name}
              content={content}
              selectors={selectors}
              balloons={balloons}
            />
          </Suspense>
        )}
      </ClientOnly>
    </div>
  );
}
