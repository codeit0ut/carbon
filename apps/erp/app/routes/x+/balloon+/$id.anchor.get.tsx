import { requirePermissions } from "@carbon/auth/auth.server";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getBalloonAnchors } from "~/modules/quality";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client } = await requirePermissions(request, {
    view: "quality"
  });

  const { id } = params;
  if (!id)
    return data({ success: false, message: "Missing id" }, { status: 400 });

  const result = await getBalloonAnchors(client, id);
  if (result.error) {
    return data(
      {
        success: false,
        message: getErrorMessage(
          result.error,
          "Failed to fetch balloon anchors"
        )
      },
      { status: 400 }
    );
  }

  return data({ success: true, data: result.data ?? [] });
}
