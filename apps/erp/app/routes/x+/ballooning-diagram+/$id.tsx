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
  getBallooningBalloons,
  getBallooningDiagram,
  getBallooningSelectors
} from "~/modules/quality";
import type { BallooningDiagramContent } from "~/modules/quality/types";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

/** Konva must not load on the server (it requires native `canvas`). */
const BalloonDiagramEditor = lazy(
  () => import("~/modules/quality/ui/Ballooning/BalloonDiagramEditor")
);

export const handle: Handle = {
  breadcrumb: msg`Ballooning Diagrams`,
  to: path.to.ballooningDiagrams,
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
    getBallooningDiagram(serviceRole, id),
    getBallooningSelectors(serviceRole, id),
    getBallooningBalloons(serviceRole, id)
  ]);

  if (diagram.error) {
    throw redirect(
      path.to.ballooningDiagrams,
      await flash(
        request,
        error(diagram.error, "Failed to load ballooning diagram")
      )
    );
  }

  if (diagram.data.companyId !== companyId) {
    throw redirect(path.to.ballooningDiagrams);
  }

  return {
    diagram: diagram.data,
    selectors: selectors.data ?? [],
    balloons: balloons.data ?? []
  };
}

export default function BallooningDetailRoute() {
  const { diagram, selectors, balloons } = useLoaderData<typeof loader>();
  const content = diagram.content as BallooningDiagramContent | null;

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
            <BalloonDiagramEditor
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
