import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { getCarbonServiceRole } from "@carbon/auth/client.server";
import { flash } from "@carbon/auth/session.server";
import { msg } from "@lingui/core/macro";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { getBallooningDiagram } from "~/modules/quality";
import type { BallooningDiagramContent } from "~/modules/quality/types";
import { BalloonDiagramEditor } from "~/modules/quality/ui/Ballooning";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

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
  const diagram = await getBallooningDiagram(serviceRole, id);

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

  return { diagram: diagram.data };
}

export default function BallooningDetailRoute() {
  const { diagram } = useLoaderData<typeof loader>();
  const content = diagram.content as BallooningDiagramContent | null;

  return (
    <div className="flex flex-col h-[calc(100dvh-49px)] overflow-hidden w-full">
      <BalloonDiagramEditor
        diagramId={diagram.id}
        name={diagram.name}
        content={content}
      />
    </div>
  );
}
