import type { Database, Json } from "@carbon/database";
import { fetchAllFromTable } from "@carbon/database";
import type { JSONContent } from "@carbon/react";
import { parseDate } from "@internationalized/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { GenericQueryFilters } from "~/utils/query";
import { setGenericQueryFilters } from "~/utils/query";
import { sanitize } from "~/utils/supabase";

import type { inspectionStatus } from "../shared";
import type {
  ballooningDiagramValidator,
  gaugeCalibrationRecordValidator,
  gaugeCalibrationStatus,
  gaugeTypeValidator,
  gaugeValidator,
  issueTypeValidator,
  issueValidator,
  issueWorkflowValidator,
  nonConformanceReviewerValidator,
  nonConformanceStatus,
  qualityDocumentStepValidator,
  qualityDocumentValidator,
  riskRegisterValidator,
  riskSource,
  riskStatus
} from "./quality.models";
export async function activateGauge(
  client: SupabaseClient<Database>,
  gaugeId: string
) {
  return client
    .from("gauges")
    .update({ gaugeStatus: "Active" })
    .eq("id", gaugeId);
}

export async function deactivateGauge(
  client: SupabaseClient<Database>,
  gaugeId: string
) {
  return client
    .from("gauges")
    .update({ gaugeStatus: "Inactive" })
    .eq("id", gaugeId);
}

export async function deleteGauge(
  client: SupabaseClient<Database>,
  gaugeId: string
) {
  return client.from("gauges").delete().eq("id", gaugeId);
}

export async function deleteGaugeCalibrationRecord(
  client: SupabaseClient<Database>,
  gaugeCalibrationRecordId: string
) {
  return client
    .from("gaugeCalibrationRecord")
    .delete()
    .eq("id", gaugeCalibrationRecordId);
}

export async function deleteGaugeType(
  client: SupabaseClient<Database>,
  gaugeTypeId: string
) {
  return client.from("gaugeType").delete().eq("id", gaugeTypeId);
}

export async function deleteIssue(
  client: SupabaseClient<Database>,
  nonConformanceId: string
) {
  return client.from("nonConformance").delete().eq("id", nonConformanceId);
}

export async function deleteIssueAssociation(
  client: SupabaseClient<Database>,
  type: string,
  associationId: string
) {
  switch (type) {
    case "items":
      return await client
        .from("nonConformanceItem")
        .delete()
        .eq("id", associationId);
    case "customers":
      return await client
        .from("nonConformanceCustomer")
        .delete()
        .eq("id", associationId);
    case "suppliers":
      return await client
        .from("nonConformanceSupplier")
        .delete()
        .eq("id", associationId);
    case "jobOperations":
      return await client
        .from("nonConformanceJobOperation")
        .delete()
        .eq("id", associationId);
    case "purchaseOrderLines":
      return await client
        .from("nonConformancePurchaseOrderLine")
        .delete()
        .eq("id", associationId);
    case "salesOrderLines":
      return await client
        .from("nonConformanceSalesOrderLine")
        .delete()
        .eq("id", associationId);
    case "shipmentLines":
      return await client
        .from("nonConformanceShipmentLine")
        .delete()
        .eq("id", associationId);
    case "receiptLines":
      return await client
        .from("nonConformanceReceiptLine")
        .delete()
        .eq("id", associationId);
    case "trackedEntities":
      return await client
        .from("nonConformanceTrackedEntity")
        .delete()
        .eq("id", associationId);
    default:
      throw new Error(`Invalid type: ${type}`);
  }
}

export async function deleteIssueType(
  client: SupabaseClient<Database>,
  nonConformanceTypeId: string
) {
  return client
    .from("nonConformanceType")
    .delete()
    .eq("id", nonConformanceTypeId);
}

export async function deleteIssueWorkflow(
  client: SupabaseClient<Database>,
  nonConformanceWorkflowId: string
) {
  return client
    .from("nonConformanceWorkflow")
    .update({ active: false })
    .eq("id", nonConformanceWorkflowId);
}

export async function deleteRequiredAction(
  client: SupabaseClient<Database>,
  requiredActionId: string
) {
  return client
    .from("nonConformanceRequiredAction")
    .delete()
    .eq("id", requiredActionId);
}

export async function deleteQualityDocument(
  client: SupabaseClient<Database>,
  qualityDocumentId: string
) {
  return client.from("qualityDocument").delete().eq("id", qualityDocumentId);
}

export async function deleteQualityDocumentStep(
  client: SupabaseClient<Database>,
  qualityDocumentStepId: string,
  companyId: string
) {
  return client
    .from("qualityDocumentStep")
    .delete()
    .eq("id", qualityDocumentStepId)
    .eq("companyId", companyId);
}

export async function deleteRisk(
  client: SupabaseClient<Database>,
  riskId: string
) {
  return client.from("riskRegister").delete().eq("id", riskId);
}

export async function getIssueFromExternalLink(
  client: SupabaseClient<Database>,
  id: string
) {
  return client
    .from("nonConformanceSupplier")
    .select("*, nonConformance(*)")
    .eq("id", id)
    .single();
}

export async function getGauge(
  client: SupabaseClient<Database>,
  gaugeId: string
) {
  return client.from("gauges").select("*").eq("id", gaugeId).single();
}

export async function getGauges(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("gauges")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.or(
      `gaugeId.ilike.%${args.search}%,description.ilike.%${args.search}%,modelNumber.ilike.%${args.search}%,serialNumber.ilike.%${args.search}%`
    );
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "gaugeId", ascending: false }
    ]);
  }

  return query;
}

export async function getGaugesList(
  client: SupabaseClient<Database>,
  companyId: string
) {
  return fetchAllFromTable<{
    id: string;
    name: string;
    gaugeId: string;
    description: string;
  }>(client, "gauge", "id, name:gaugeId, description", (query) =>
    query.eq("companyId", companyId)
  );
}

export async function getGaugeCalibrationRecord(
  client: SupabaseClient<Database>,
  id: string
) {
  return client
    .from("gaugeCalibrationRecords")
    .select("*")
    .eq("id", id)
    .single();
}

export async function getGaugeCalibrationRecords(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("gaugeCalibrationRecords")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.or(
      `gaugeId.ilike.%${args.search}%,description.ilike.%${args.search}%,modelNumber.ilike.%${args.search}%,serialNumber.ilike.%${args.search}%`
    );
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "createdAt", ascending: false },
      { column: "dateCalibrated", ascending: false }
    ]);
  }

  return query;
}

export async function getGaugeCalibrationRecordsByGaugeId(
  client: SupabaseClient<Database>,
  gaugeId: string
) {
  return client
    .from("gaugeCalibrationRecords")
    .select("*")
    .eq("gaugeId", gaugeId)
    .order("createdAt", { ascending: false });
}

export async function getGaugeTypesList(
  client: SupabaseClient<Database>,
  companyId: string
) {
  return client
    .from("gaugeType")
    .select("id, name")
    .eq("companyId", companyId)
    .order("name");
}

export async function getGaugeType(
  client: SupabaseClient<Database>,
  gaugeTypeId: string
) {
  return client.from("gaugeType").select("*").eq("id", gaugeTypeId).single();
}

export async function getGaugeTypes(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("gaugeType")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.ilike("name", `%${args.search}%`);
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "name", ascending: true }
    ]);
  }

  return query;
}

export async function getIssue(
  client: SupabaseClient<Database>,
  nonConformanceId: string
) {
  return client
    .from("nonConformance")
    .select("*")
    .eq("id", nonConformanceId)
    .single();
}

export async function getIssues(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("issues")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.or(
      `nonConformanceId.ilike.%${args.search}%,name.ilike.%${args.search}%`
    );
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "nonConformanceId", ascending: false }
    ]);
  }

  return query;
}

export async function getIssueWorkflow(
  client: SupabaseClient<Database>,
  nonConformanceWorkflowId: string
) {
  return client
    .from("nonConformanceWorkflow")
    .select("*")
    .eq("id", nonConformanceWorkflowId)
    .single();
}

export async function getIssueAction(
  client: SupabaseClient<Database>,
  id: string
) {
  return client
    .from("nonConformanceActionTask")
    .select("id,notes,nonConformanceId,nonConformance(id,nonConformanceId)")
    .eq("id", id)
    .single();
}

export async function getIssueActionTasks(
  client: SupabaseClient<Database>,
  id: string,
  companyId: string,
  supplierId?: string
) {
  let query = client
    .from("nonConformanceActionTask")
    .select(
      "*, ...nonConformanceRequiredAction(name), nonConformanceActionProcess(processId, ...process(name)), supplier(name)"
    )
    .eq("nonConformanceId", id)
    .eq("companyId", companyId);

  if (supplierId) {
    query = query.eq("supplierId", supplierId);
  }

  const result = await query;

  if (result.error || !result.data) {
    return result;
  }

  // Fetch Linear and Jira mappings for all action task IDs
  const taskIds = result.data.map((t) => t.id);
  let linearMappings: Map<string, unknown> = new Map();
  let jiraMappings: Map<string, unknown> = new Map();

  if (taskIds.length > 0) {
    const [{ data: linearData }, { data: jiraData }] = await Promise.all([
      client
        .from("externalIntegrationMapping")
        .select("entityId, metadata")
        .eq("entityType", "nonConformanceActionTask")
        .eq("integration", "linear")
        .in("entityId", taskIds),
      client
        .from("externalIntegrationMapping")
        .select("entityId, metadata")
        .eq("entityType", "nonConformanceActionTask")
        .eq("integration", "jira")
        .in("entityId", taskIds)
    ]);

    linearMappings = new Map(
      (linearData ?? []).map((m) => [m.entityId, m.metadata])
    );
    jiraMappings = new Map(
      (jiraData ?? []).map((m) => [m.entityId, m.metadata])
    );
  }

  return {
    ...result,
    data: result.data.map((task) => ({
      ...task,
      linearIssue: linearMappings.get(task.id) ?? null,
      jiraIssue: jiraMappings.get(task.id) ?? null
    }))
  };
}

export async function getIssueApprovalTasks(
  client: SupabaseClient<Database>,
  id: string,
  companyId: string
) {
  return client
    .from("nonConformanceApprovalTask")
    .select("*")
    .eq("nonConformanceId", id)
    .eq("companyId", companyId)
    .order("approvalType", { ascending: true });
}

export async function getIssueItems(
  client: SupabaseClient<Database>,
  id: string,
  companyId: string
) {
  return client
    .from("nonConformanceItem")
    .select("*, ...item(name)")
    .eq("nonConformanceId", id)
    .eq("companyId", companyId)
    .order("createdAt", { ascending: true });
}

export async function getIssueAssociations(
  client: SupabaseClient<Database>,
  nonConformanceId: string,
  companyId: string
) {
  const [
    items,
    jobOperations,
    jobsFromSteps,
    purchaseOrderLines,
    salesOrderLines,
    shipmentLines,
    receiptLines,
    trackedEntities,
    customers,
    suppliers
  ] = await Promise.all([
    // Items
    client
      .from("nonConformanceItem")
      .select(
        `
      id,
      itemId,
      disposition,
      quantity,
      createdAt,
      ...item(
        readableIdWithRevision
      )
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),
    // Job Operations
    client
      .from("nonConformanceJobOperation")
      .select(
        `
        id,
        jobOperationId,
        jobId,
        jobReadableId,
        jobOperation (
          id,
          process (
            name
          )
        )
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    client
      .from("jobOperationStep")
      .select(
        `
        id,
        nonConformanceActionTask!inner (
          nonConformanceId
        ),
        jobOperation!inner (
          id,
          jobId,
          job!inner (
            id,
            jobId
          ),
          process (
            name
          )
        )
      `
      )
      .eq("nonConformanceActionTask.nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    // Purchase Order Lines
    client
      .from("nonConformancePurchaseOrderLine")
      .select(
        `
        id,
        purchaseOrderLineId,
        purchaseOrderId,
        purchaseOrderReadableId
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    // Sales Order Lines
    client
      .from("nonConformanceSalesOrderLine")
      .select(
        `
        id,
        salesOrderLineId,
        salesOrderId,
        salesOrderReadableId
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    // Shipment Lines
    client
      .from("nonConformanceShipmentLine")
      .select(
        `
        id,
        shipmentLineId,
        shipmentId,
        shipmentReadableId
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    // Receipt Lines
    client
      .from("nonConformanceReceiptLine")
      .select(
        `
        id,
        receiptLineId,
        receiptId,
        receiptReadableId
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    // Tracked Entities
    client
      .from("nonConformanceTrackedEntity")
      .select(
        `
        id,
        trackedEntityId,
        trackedEntity:trackedEntity (
          id,
          readableId
        )
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    // Customers
    client
      .from("nonConformanceCustomer")
      .select(
        `
        id,
        customerId,
        customer:customer (
          id,
          name
        )
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId),

    // Suppliers
    client
      .from("nonConformanceSupplier")
      .select(
        `
        id,
        supplierId,
        supplier:supplier (
          id,
          name
        )
      `
      )
      .eq("nonConformanceId", nonConformanceId)
      .eq("companyId", companyId)
  ]);

  return {
    items:
      items.data?.map((item) => ({
        type: "items",
        id: item.id,
        documentId: item.itemId,
        documentReadableId: item.readableIdWithRevision || "",
        documentLineId: "",
        disposition: item.disposition,
        quantity: item.quantity,
        createdAt: item.createdAt
      })) || [],
    jobOperations: [
      // Manually-associated job operations
      ...(jobOperations.data?.map((item) => ({
        type: "jobOperations",
        id: item.id,
        documentId: item.jobId ?? "",
        documentLineId: item.jobOperationId,
        documentReadableId: `${item.jobReadableId || ""} - ${
          item.jobOperation?.process?.name || ""
        }`
      })) || []),
      // Jobs from inspection steps
      ...(jobsFromSteps.data?.map((step) => ({
        type: "jobOperationsInspection",
        id: step.id,
        documentId: step.jobOperation?.job?.id ?? "",
        documentLineId: step.jobOperation?.id ?? "",
        documentReadableId: `${step.jobOperation?.job?.jobId || ""} - ${
          step.jobOperation?.process?.name || ""
        }`
      })) || [])
    ],
    purchaseOrderLines:
      purchaseOrderLines.data?.map((item) => ({
        id: item.id,
        type: "purchaseOrderLines",
        documentId: item.purchaseOrderId ?? "",
        documentLineId: item.purchaseOrderLineId,
        documentReadableId: item.purchaseOrderReadableId || ""
      })) || [],
    salesOrderLines:
      salesOrderLines.data?.map((item) => ({
        id: item.id,
        type: "salesOrderLines",
        documentId: item.salesOrderId ?? "",
        documentLineId: item.salesOrderLineId,
        documentReadableId: item.salesOrderReadableId || ""
      })) || [],
    shipmentLines:
      shipmentLines.data?.map((item) => ({
        id: item.id,
        type: "shipmentLines",
        documentId: item.shipmentId ?? "",
        documentLineId: item.shipmentLineId,
        documentReadableId: item.shipmentReadableId || ""
      })) || [],
    receiptLines:
      receiptLines.data?.map((item) => ({
        id: item.id,
        type: "receiptLines",
        documentId: item.receiptId ?? "",
        documentLineId: item.receiptLineId,
        documentReadableId: item.receiptReadableId || ""
      })) || [],
    trackedEntities:
      trackedEntities.data?.map((item) => ({
        id: item.id,
        type: "trackedEntities",
        documentId: item.trackedEntityId ?? "",
        documentLineId: "",
        documentReadableId:
          item.trackedEntity?.readableId ?? item.trackedEntityId ?? ""
      })) || [],
    customers:
      customers.data?.map((c) => ({
        id: c.id,
        type: "customers",
        documentId: c.customerId ?? "",
        documentLineId: "",
        documentReadableId: c.customer.name
      })) || [],
    suppliers:
      suppliers.data?.map((item) => ({
        id: item.id,
        type: "suppliers",
        documentId: item.supplierId ?? "",
        documentLineId: "",
        documentReadableId: item.supplier.name
      })) || []
  };
}

export async function getIssueReviewers(
  client: SupabaseClient<Database>,
  id: string,
  companyId: string
) {
  return client
    .from("nonConformanceReviewer")
    .select("*")
    .eq("nonConformanceId", id)
    .eq("companyId", companyId)
    .order("id", { ascending: true });
}

export async function getIssueSuppliers(
  client: SupabaseClient<Database>,
  id: string,
  companyId: string
) {
  return client
    .from("nonConformanceSupplier")
    .select("supplierId, externalLinkId")
    .eq("nonConformanceId", id)
    .eq("companyId", companyId)
    .order("id", { ascending: true });
}

export async function getIssueTasks(
  client: SupabaseClient<Database>,
  id: string,
  companyId: string
) {
  return Promise.all([
    client
      .from("nonConformanceActionTask")
      .select("*")
      .eq("nonConformanceId", id)
      .eq("companyId", companyId)
      .order("createdAt", { ascending: true }),
    client
      .from("nonConformanceApprovalTask")
      .select("*")
      .eq("nonConformanceId", id)
      .eq("companyId", companyId)
      .order("approvalType", { ascending: true })
  ]);
}

export async function getIssueType(
  client: SupabaseClient<Database>,
  nonConformanceTypeId: string
) {
  return client
    .from("nonConformanceType")
    .select("*")
    .eq("id", nonConformanceTypeId)
    .single();
}

export async function getIssueTypes(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("nonConformanceType")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.ilike("name", `%${args.search}%`);
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "name", ascending: true }
    ]);
  }

  return query;
}

export async function getIssueWorkflows(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("nonConformanceWorkflow")
    .select("*", { count: "exact" })
    .eq("companyId", companyId)
    .eq("active", true);

  if (args?.search) {
    query = query.ilike("name", `%${args.search}%`);
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "name", ascending: true }
    ]);
  }

  return query;
}

export async function getIssueWorkflowsList(
  client: SupabaseClient<Database>,
  companyId: string
) {
  return client
    .from("nonConformanceWorkflow")
    .select("*")
    .eq("companyId", companyId)
    .eq("active", true)
    .order("name");
}

export async function getIssueTypesList(
  client: SupabaseClient<Database>,
  companyId: string
) {
  return client
    .from("nonConformanceType")
    .select("id, name")
    .eq("companyId", companyId)
    .order("name");
}

export async function getQualityActions(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("qualityActions")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.or(
      `readableNonConformanceId.ilike.%${args.search}%,nonConformanceName.ilike.%${args.search}%,name.ilike.%${args.search}%,description.ilike.%${args.search}%`
    );
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "createdAt", ascending: false }
    ]);
  }

  return query;
}

export async function getQualityDocument(
  client: SupabaseClient<Database>,
  id: string
) {
  return client
    .from("qualityDocument")
    .select("*, qualityDocumentStep(*)")
    .eq("id", id)
    .single();
}

export async function getQualityDocumentSteps(
  client: SupabaseClient<Database>,
  qualityDocumentId: string
) {
  return client
    .from("qualityDocumentStep")
    .select("*")
    .eq("qualityDocumentId", qualityDocumentId);
}

export async function getQualityDocumentVersions(
  client: SupabaseClient<Database>,
  qualityDocument: { name: string; version: number },
  companyId: string
) {
  return client
    .from("qualityDocument")
    .select("*")
    .eq("name", qualityDocument.name)
    .eq("companyId", companyId)
    .neq("version", qualityDocument.version)
    .order("version", { ascending: false });
}

export async function getQualityDocuments(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: { search: string | null } & GenericQueryFilters
) {
  let query = client
    .from("qualityDocuments")
    .select("*", {
      count: "exact"
    })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.ilike("name", `%${args.search}%`);
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "name", ascending: true }
    ]);
  }

  return query;
}

export async function getQualityDocumentsList(
  client: SupabaseClient<Database>,
  companyId: string
) {
  return fetchAllFromTable<{
    id: string;
    name: string;
    version: number;
    processId: string;
    status: string;
  }>(
    client,
    "qualityDocument",
    "id, name, version, processId, status",
    (query) =>
      query
        .eq("companyId", companyId)
        .order("name", { ascending: true })
        .order("version", { ascending: false })
  );
}

export async function getQualityFiles(
  client: SupabaseClient<Database>,
  id: string,
  companyId: string
) {
  const result = await client.storage
    .from("private")
    .list(`${companyId}/quality/${id}`);
  return result.data || [];
}

export async function getRequiredActionsList(
  client: SupabaseClient<Database>,
  companyId: string
) {
  return client
    .from("nonConformanceRequiredAction")
    .select("id, name")
    .eq("companyId", companyId)
    .eq("active", true)
    .order("name");
}

export async function getRequiredActions(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("nonConformanceRequiredAction")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.ilike("name", `%${args.search}%`);
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "name", ascending: true }
    ]);
  }

  return query;
}

export async function getRequiredAction(
  client: SupabaseClient<Database>,
  requiredActionId: string
) {
  return client
    .from("nonConformanceRequiredAction")
    .select("*")
    .eq("id", requiredActionId)
    .single();
}

export async function getRisk(
  client: SupabaseClient<Database>,
  riskId: string
) {
  return client.from("riskRegister").select("*").eq("id", riskId).single();
}

export async function getRisks(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: GenericQueryFilters & {
    search: string | null;
    status?: typeof riskStatus;
    source?: typeof riskSource;
    // might be needed later for filtering by assignee
    assignee?: string[];
  }
) {
  let query = client
    .from("riskRegisters")
    .select("*", {
      count: "exact"
    })
    .eq("companyId", companyId);

  if (args?.search) {
    query = query.or(
      `title.ilike.%${args.search}%,description.ilike.%${args.search}%`
    );
  }

  if (args?.status && args.status.length > 0) {
    query = query.in("status", args.status);
  }

  if (args?.source && args.source.length > 0) {
    query = query.in("source", args.source);
  }

  if (args?.assignee && args.assignee.length > 0) {
    query = query.in("assignee", args.assignee);
  }

  if (args) {
    query = setGenericQueryFilters(query, args, [
      { column: "createdAt", ascending: false }
    ]);
  }

  return query;
}

export async function insertIssueReviewer(
  client: SupabaseClient<Database>,
  reviewer: z.infer<typeof nonConformanceReviewerValidator> & {
    nonConformanceId: string;
    companyId: string;
    createdBy: string;
  }
) {
  return client.from("nonConformanceReviewer").insert(reviewer);
}

export async function updateIssueActionProcesses(
  client: SupabaseClient<Database>,
  args: {
    actionTaskId: string;
    processIds: string[];
    companyId: string;
    createdBy: string;
  }
) {
  const { actionTaskId, processIds, companyId, createdBy } = args;
  // Delete all existing process associations
  const deleteResult = await client
    .from("nonConformanceActionProcess")
    .delete()
    .eq("actionTaskId", actionTaskId);

  if (deleteResult.error) {
    return deleteResult;
  }

  // Insert new process associations
  if (processIds.length > 0) {
    return client.from("nonConformanceActionProcess").insert(
      processIds.map((processId) => ({
        actionTaskId: actionTaskId,
        processId,
        companyId: companyId,
        createdBy: createdBy
      }))
    );
  } else {
    return deleteResult;
  }
}

export async function updateIssueStatus(
  client: SupabaseClient<Database>,
  update: {
    id: string;
    status: (typeof nonConformanceStatus)[number];
    assignee: string | null | undefined;
    closeDate: string | null | undefined;
    updatedBy: string;
  }
) {
  return client.from("nonConformance").update(update).eq("id", update.id);
}

export async function updateIssueTaskStatus(
  client: SupabaseClient<Database>,
  args: {
    id: string;
    status: "Pending" | "Completed" | "Skipped" | "In Progress";
    type: "investigation" | "action" | "approval" | "review";
    userId?: string;
    assignee?: string | null;
  }
) {
  const { id, status, type, userId, assignee } = args;
  const table =
    type === "action" || type === "investigation"
      ? "nonConformanceActionTask"
      : type === "review"
        ? "nonConformanceReviewer"
        : "nonConformanceApprovalTask";

  const finalAssignee = assignee || userId;

  // Set completedDate to today when status is "Completed"
  const updateData = {
    status,
    updatedBy: userId,
    assignee: finalAssignee
  };

  if (status === "Completed") {
    // @ts-expect-error
    updateData.completedDate = new Date().toISOString().split("T")[0];
  }

  return client
    .from(table)
    .update(updateData)
    .eq("id", id)
    .select("nonConformanceId")
    .single();
}

export async function updateIssueTaskContent(
  client: SupabaseClient<Database>,
  args: {
    id: string;
    type: "action" | "approval" | "review";
    content: JSONContent;
  }
) {
  const { id, content, type } = args;
  const table =
    type === "action"
      ? "nonConformanceActionTask"
      : type === "review"
        ? "nonConformanceReviewer"
        : "nonConformanceApprovalTask";

  return client
    .from(table)
    .update({ notes: content })
    .eq("id", id)
    .select("nonConformanceId")
    .single();
}

export async function updateQualityDocumentStepOrder(
  client: SupabaseClient<Database>,
  updates: {
    id: string;
    sortOrder: number;
    updatedBy: string;
  }[]
) {
  const updatePromises = updates.map(({ id, sortOrder, updatedBy }) =>
    client
      .from("qualityDocumentStep")
      .update({ sortOrder, updatedBy })
      .eq("id", id)
  );
  return Promise.all(updatePromises);
}

export async function updateRiskStatus(
  client: SupabaseClient<Database>,
  riskId: string,
  status: (typeof riskStatus)[number]
) {
  return client.from("riskRegister").update({ status }).eq("id", riskId);
}

export async function upsertGauge(
  client: SupabaseClient<Database>,
  gauge:
    | (Omit<z.infer<typeof gaugeValidator>, "id" | "gaugeId"> & {
        gaugeId: string;
        companyId: string;
        gaugeCalibrationStatus: (typeof gaugeCalibrationStatus)[number];
        createdBy: string;
        customFields?: Json;
      })
    | (Omit<z.infer<typeof gaugeValidator>, "id" | "gaugeId"> & {
        id: string;
        gaugeId: string;
        gaugeCalibrationStatus: (typeof gaugeCalibrationStatus)[number];
        updatedBy: string;
        customFields?: Json;
      })
) {
  if ("createdBy" in gauge) {
    return client.from("gauges").insert([gauge]).select("id, gaugeId").single();
  } else {
    return client.from("gauges").update(sanitize(gauge)).eq("id", gauge.id);
  }
}

export async function upsertGaugeCalibrationRecord(
  client: SupabaseClient<Database>,
  gaugeCalibrationRecord:
    | (Omit<z.infer<typeof gaugeCalibrationRecordValidator>, "id"> & {
        companyId: string;
        inspectionStatus: (typeof inspectionStatus)[number];
        createdBy: string;
        customFields?: Json;
      })
    | (Omit<z.infer<typeof gaugeCalibrationRecordValidator>, "id"> & {
        id: string;
        inspectionStatus: (typeof inspectionStatus)[number];
        updatedBy: string;
        customFields?: Json;
      })
) {
  const userId =
    "updatedBy" in gaugeCalibrationRecord
      ? gaugeCalibrationRecord.updatedBy
      : gaugeCalibrationRecord.createdBy;
  const gauge = await client
    .from("gauge")
    .select("*")
    .eq("id", gaugeCalibrationRecord.gaugeId)
    .single();

  if (gauge.error) return gauge;

  if (
    !gauge.data?.lastCalibrationDate ||
    parseDate(gauge.data.lastCalibrationDate) <=
      parseDate(gaugeCalibrationRecord.dateCalibrated)
  ) {
    const nextCalibrationDate = parseDate(gaugeCalibrationRecord.dateCalibrated)
      .add({
        months: gauge.data.calibrationIntervalInMonths
      })
      .toString();

    const update = await client
      .from("gauge")
      .update({
        gaugeCalibrationStatus:
          gaugeCalibrationRecord.inspectionStatus === "Pass"
            ? "In-Calibration"
            : "Out-of-Calibration",
        lastCalibrationDate: gaugeCalibrationRecord.dateCalibrated,
        nextCalibrationDate: nextCalibrationDate,
        // Reset lastCalibrationStatus when gauge passes calibration to allow future notifications
        lastCalibrationStatus:
          gaugeCalibrationRecord.inspectionStatus === "Pass"
            ? "In-Calibration"
            : gauge.data.lastCalibrationStatus,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      })
      .eq("id", gaugeCalibrationRecord.gaugeId);

    if (update.error) return update;
  }

  if ("createdBy" in gaugeCalibrationRecord) {
    const data = sanitize(gaugeCalibrationRecord);
    if (data.humidity === 0) data.humidity = undefined;
    if (data.temperature === 0) data.temperature = undefined;

    return client
      .from("gaugeCalibrationRecord")
      .insert([data])
      .select("id")
      .single();
  }
  return client
    .from("gaugeCalibrationRecord")
    .update(
      sanitize({
        ...gaugeCalibrationRecord,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      })
    )
    .eq("id", gaugeCalibrationRecord.id);
}

export async function upsertGaugeType(
  client: SupabaseClient<Database>,
  gaugeType:
    | (Omit<z.infer<typeof gaugeTypeValidator>, "id"> & {
        companyId: string;
        createdBy: string;
        customFields?: Json;
      })
    | (Omit<z.infer<typeof issueTypeValidator>, "id"> & {
        id: string;
        updatedBy: string;
        customFields?: Json;
      })
) {
  if ("createdBy" in gaugeType) {
    return client.from("gaugeType").insert([gaugeType]).select("id");
  } else {
    return client
      .from("gaugeType")
      .update(sanitize(gaugeType))
      .eq("id", gaugeType.id);
  }
}

export async function upsertIssue(
  client: SupabaseClient<Database>,
  nonConformance:
    | (Omit<z.infer<typeof issueValidator>, "id" | "nonConformanceId"> & {
        nonConformanceId: string;
        companyId: string;
        createdBy: string;
        customFields?: Json;
      })
    | (Omit<z.infer<typeof issueValidator>, "id" | "nonConformanceId"> & {
        id: string;
        nonConformanceId: string;
        updatedBy: string;
        customFields?: Json;
      })
) {
  if ("createdBy" in nonConformance) {
    const {
      items,
      jobOperationId,
      customerId,
      salesOrderLineId,
      operationSupplierProcessId,
      ...data
    } = nonConformance;
    const result = await client
      .from("nonConformance")
      .insert([data])
      .select("id")
      .single();

    if (result.data?.id) {
      if (items && items.length > 0) {
        const itemInsert = await client.from("nonConformanceItem").insert(
          items.map((item) => ({
            nonConformanceId: result.data.id,
            itemId: item,
            companyId: nonConformance.companyId,
            createdBy: nonConformance.createdBy
          }))
        );
        if (itemInsert.error) {
          console.error(itemInsert);
        }
      }
      if (jobOperationId) {
        const jobOperation = await client
          .from("jobOperation")
          .select("*")
          .eq("id", jobOperationId)
          .single();
        if (jobOperation?.data) {
          const job = await client
            .from("job")
            .select("*")
            .eq("id", jobOperation.data.jobId)
            .single();
          if (job.data) {
            const jobOperationInsert = await client
              .from("nonConformanceJobOperation")
              .insert([
                {
                  jobId: jobOperation.data.jobId,
                  jobOperationId,
                  nonConformanceId: result.data.id,
                  jobReadableId: job.data?.jobId,
                  companyId: nonConformance.companyId,
                  createdBy: nonConformance.createdBy
                }
              ]);
            if (jobOperationInsert.error) {
              console.error(jobOperationInsert);
            }
          }
        }
      }
      if (customerId) {
        const customerInsert = await client
          .from("nonConformanceCustomer")
          .insert([
            {
              companyId: nonConformance.companyId,
              createdBy: nonConformance.createdBy,
              customerId: customerId,
              nonConformanceId: result.data.id
            }
          ]);

        if (customerInsert.error) {
          console.error(customerInsert);
        }
      }
      if (salesOrderLineId) {
        const salesOrderLine = await client
          .from("salesOrderLine")
          .select("*, salesOrder(salesOrderId)")
          .eq("id", salesOrderLineId)
          .single();
        if (salesOrderLine.data) {
          const salesOrderLineInsert = await client
            .from("nonConformanceSalesOrderLine")
            .insert([
              {
                companyId: nonConformance.companyId,
                createdBy: nonConformance.createdBy,
                salesOrderLineId: salesOrderLineId,
                salesOrderId: salesOrderLine.data.salesOrderId,
                salesOrderReadableId:
                  salesOrderLine.data.salesOrder.salesOrderId,
                nonConformanceId: result.data.id
              }
            ]);

          if (salesOrderLineInsert.error) {
            console.error(salesOrderLineInsert);
          }
        }
      }
      if (operationSupplierProcessId) {
        const operationSupplierProcess = await client
          .from("supplierProcess")
          .select("*")
          .eq("id", operationSupplierProcessId)
          .single();

        if (operationSupplierProcess.data) {
          const nonConformanceSupplierInsert = await client
            .from("nonConformanceSupplier")
            .insert([
              {
                companyId: nonConformance.companyId,
                createdBy: nonConformance.createdBy,
                supplierId: operationSupplierProcess.data.supplierId,
                nonConformanceId: result.data.id
              }
            ]);

          if (nonConformanceSupplierInsert.error) {
            console.error(nonConformanceSupplierInsert);
          }
        }
      }
    }

    return result;
  } else {
    // biome-ignore lint/correctness/noUnusedVariables: suppressed due to migration
    const { items, ...data } = nonConformance;
    return client
      .from("nonConformance")
      .update(sanitize(data))
      .eq("id", nonConformance.id);
  }
}

export async function upsertIssueWorkflow(
  client: SupabaseClient<Database>,
  nonConformanceWorkflow:
    | (Omit<z.infer<typeof issueWorkflowValidator>, "id"> & {
        companyId: string;
        createdBy: string;
      })
    | (Omit<z.infer<typeof issueWorkflowValidator>, "id"> & {
        id: string;
        updatedBy: string;
      })
) {
  if ("createdBy" in nonConformanceWorkflow) {
    return client
      .from("nonConformanceWorkflow")
      .insert([nonConformanceWorkflow])
      .select("id")
      .single();
  } else {
    return client
      .from("nonConformanceWorkflow")
      .update(sanitize(nonConformanceWorkflow))
      .eq("id", nonConformanceWorkflow.id);
  }
}

export async function upsertIssueType(
  client: SupabaseClient<Database>,
  nonConformanceType:
    | (Omit<z.infer<typeof issueTypeValidator>, "id"> & {
        companyId: string;
        createdBy: string;
        customFields?: Json;
      })
    | (Omit<z.infer<typeof issueTypeValidator>, "id"> & {
        id: string;
        updatedBy: string;
        customFields?: Json;
      })
) {
  if ("createdBy" in nonConformanceType) {
    return client
      .from("nonConformanceType")
      .insert([nonConformanceType])
      .select("id");
  } else {
    return client
      .from("nonConformanceType")
      .update(sanitize(nonConformanceType))
      .eq("id", nonConformanceType.id);
  }
}

export async function upsertRequiredAction(
  client: SupabaseClient<Database>,
  requiredAction:
    | (Omit<z.infer<typeof issueTypeValidator>, "id"> & {
        companyId: string;
        active?: boolean;
        createdBy: string;
      })
    | (Omit<z.infer<typeof issueTypeValidator>, "id"> & {
        id: string;
        active?: boolean;
        updatedBy: string;
      })
) {
  if ("createdBy" in requiredAction) {
    return client
      .from("nonConformanceRequiredAction")
      .insert([requiredAction])
      .select("id");
  } else {
    return client
      .from("nonConformanceRequiredAction")
      .update(sanitize(requiredAction))
      .eq("id", requiredAction.id);
  }
}

export async function upsertQualityDocument(
  client: SupabaseClient<Database>,
  qualityDocument:
    | (Omit<z.infer<typeof qualityDocumentValidator>, "id"> & {
        companyId: string;
        createdBy: string;
      })
    | (Omit<z.infer<typeof qualityDocumentValidator>, "id"> & {
        id: string;
        updatedBy: string;
      })
) {
  const { copyFromId, ...rest } = qualityDocument;
  if ("id" in rest) {
    return client
      .from("qualityDocument")
      .update(sanitize(rest))
      .eq("id", rest.id)
      .select("id")
      .single();
  }

  const insert = await client
    .from("qualityDocument")
    .insert([rest])
    .select("id")
    .single();
  if (insert.error) {
    return insert;
  }
  if (copyFromId) {
    const qualityDocument = await client
      .from("qualityDocument")
      .select("*, qualityDocumentStep(*)")
      .eq("id", copyFromId)
      .single();

    if (qualityDocument.error) {
      return qualityDocument;
    }

    const steps = qualityDocument.data.qualityDocumentStep ?? [];
    const workInstruction = (qualityDocument.data.content ?? {}) as JSONContent;

    const [updateWorkInstructions, insertSteps] = await Promise.all([
      client
        .from("qualityDocument")
        .update({
          content: workInstruction,
          tags: qualityDocument.data.tags
        })
        .eq("id", insert.data.id),
      steps.length > 0
        ? client.from("qualityDocumentStep").insert(
            steps.map((step) => {
              // biome-ignore lint/correctness/noUnusedVariables: suppressed due to migration
              const { id, qualityDocumentId, ...rest } = step;
              return {
                ...rest,
                qualityDocumentId: insert.data.id,
                companyId: qualityDocument.data.companyId!
              };
            })
          )
        : Promise.resolve({ data: null, error: null })
    ]);

    if (updateWorkInstructions.error) {
      return updateWorkInstructions;
    }
    if (insertSteps.error) {
      return insertSteps;
    }
  }
  return insert;
}

export async function upsertQualityDocumentStep(
  client: SupabaseClient<Database>,
  qualityDocumentStep:
    | (Omit<z.infer<typeof qualityDocumentStepValidator>, "id"> & {
        companyId: string;
        createdBy: string;
      })
    | (Omit<z.infer<typeof qualityDocumentStepValidator>, "id"> & {
        id: string;
        updatedBy: string;
      })
) {
  if ("id" in qualityDocumentStep) {
    return client
      .from("qualityDocumentStep")
      .update(sanitize(qualityDocumentStep))
      .eq("id", qualityDocumentStep.id)
      .select("id")
      .single();
  }
  return client
    .from("qualityDocumentStep")
    .insert([qualityDocumentStep])
    .select("id")
    .single();
}

export async function upsertRisk(
  client: SupabaseClient<Database>,
  risk:
    | (Omit<
        z.infer<typeof riskRegisterValidator>,
        "id" | "severity" | "likelihood"
      > & {
        severity: number;
        likelihood: number;
        companyId: string;
        createdBy: string;
      })
    | (Omit<
        z.infer<typeof riskRegisterValidator>,
        "id" | "severity" | "likelihood"
      > & {
        severity: number;
        likelihood: number;
        id: string;
        updatedBy: string; // This might be used for history/tracking if added
      })
) {
  if ("id" in risk) {
    const { updatedBy, ...data } = risk;
    return client
      .from("riskRegister")
      .update({
        ...sanitize(data),
        updatedBy,
        updatedAt: new Date().toISOString()
      })
      .eq("id", risk.id)
      .select("id")
      .single();
  } else {
    return client
      .from("riskRegister")
      .insert([
        {
          ...sanitize(risk)
        }
      ])
      .select("id")
      .single();
  }
}

// ─── Ballooning Diagrams ─────────────────────────────────────────────────────
// Stored in ballooningDrawing
// This first step intentionally de-links ballooning diagrams from qualityDocument content.

function toStoragePath(pdfUrl?: string | null) {
  if (!pdfUrl) return null;
  const previewPrefix = "/file/preview/private/";
  if (pdfUrl.startsWith(previewPrefix)) {
    return pdfUrl.slice(previewPrefix.length);
  }
  return pdfUrl;
}

function toPreviewUrl(storagePath?: string | null) {
  if (!storagePath) return null;
  return storagePath.startsWith("/file/preview/private/")
    ? storagePath
    : `/file/preview/private/${storagePath}`;
}

function fileNameFromPath(storagePath?: string | null) {
  if (!storagePath) return "drawing.pdf";
  return storagePath.split("/").at(-1) ?? "drawing.pdf";
}

function mapBallooningDrawingToDiagram(row: Record<string, unknown>) {
  const drawingNumber = (row.drawingNumber as string | null) ?? null;
  return {
    id: String(row.id),
    name: String(drawingNumber ?? row.fileName ?? "Untitled Diagram"),
    companyId: String(row.companyId),
    createdBy: String(row.createdBy),
    updatedBy: (row.updatedBy as string | null) ?? null,
    createdAt: String(row.createdAt),
    updatedAt: (row.updatedAt as string | null) ?? null,
    qualityDocumentId: String(row.qualityDocumentId),
    content: {
      drawingNumber,
      revision: (row.revision as string | null) ?? null,
      pdfUrl: toPreviewUrl((row.storagePath as string | null) ?? null),
      annotations: [],
      features: []
    }
  };
}

export async function getBallooningDiagrams(
  client: SupabaseClient<Database>,
  companyId: string,
  args?: { search: string | null } & GenericQueryFilters
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      select: (
        columns: string,
        options?: { count?: "exact" }
      ) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          is: (
            column: string,
            value: null
          ) => {
            or: (filter: string) => Promise<{
              data: Record<string, unknown>[] | null;
              count: number | null;
              error: unknown;
            }>;
            order: (
              column: string,
              opts: { ascending: boolean }
            ) => Promise<{
              data: Record<string, unknown>[] | null;
              count: number | null;
              error: unknown;
            }>;
          };
        };
      };
    };
  };

  let query = drawingClient
    .from("ballooningDrawing")
    .select("*", { count: "exact" })
    .eq("companyId", companyId)
    .is("deletedAt", null);

  const result = args?.search
    ? await query.or(
        `drawingNumber.ilike.%${args.search}%,fileName.ilike.%${args.search}%`
      )
    : await query.order("drawingNumber", { ascending: true });

  return {
    data: (result.data ?? []).map(mapBallooningDrawingToDiagram),
    count: result.count ?? 0,
    error: result.error
  };
}

export async function getBallooningDiagram(
  client: SupabaseClient<Database>,
  id: string
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          is: (
            column: string,
            value: null
          ) => {
            single: () => Promise<{
              data: Record<string, unknown> | null;
              error: unknown;
            }>;
          };
        };
      };
    };
  };

  const result = await drawingClient
    .from("ballooningDrawing")
    .select("*")
    .eq("id", id)
    .is("deletedAt", null)
    .single();

  return {
    data: result.data ? mapBallooningDrawingToDiagram(result.data) : null,
    error: result.error
  };
}

export async function upsertBallooningDiagram(
  client: SupabaseClient<Database>,
  diagram:
    | (Omit<z.infer<typeof ballooningDiagramValidator>, "id"> & {
        id?: undefined;
        companyId: string;
        createdBy: string;
        pageCount?: number;
        defaultPageWidth?: number;
        defaultPageHeight?: number;
      })
    | (Omit<z.infer<typeof ballooningDiagramValidator>, "id"> & {
        id: string;
        companyId?: string;
        createdBy: string;
        updatedBy?: string;
        pageCount?: number;
        defaultPageWidth?: number;
        defaultPageHeight?: number;
      })
) {
  const {
    id,
    name,
    drawingNumber,
    revision,
    pdfUrl,
    pageCount,
    defaultPageWidth,
    defaultPageHeight,
    companyId,
    createdBy,
    updatedBy
  } = diagram;

  const drawingClient = client as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          select: (columns: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: unknown;
            }>;
          };
        };
      };
      insert: (payload: Record<string, unknown>) => {
        select: (columns: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  const storagePath = toStoragePath(pdfUrl);

  if (id) {
    const existingResult = await drawingClient
      .from("ballooningDrawing")
      .select("*")
      .eq("id", id)
      .is("deletedAt", null)
      .single();

    const existing = existingResult.data;
    if (!existing) {
      return {
        data: null,
        error: {
          message: "Ballooning drawing not found"
        }
      };
    }

    await client
      .from("qualityDocument")
      .update({
        name,
        updatedBy: updatedBy ?? createdBy,
        updatedAt: new Date().toISOString()
      })
      .eq("id", String(existing.qualityDocumentId));

    const updatePayload: Record<string, unknown> = {
      drawingNumber: drawingNumber ?? name,
      revision: revision ?? null,
      updatedBy: updatedBy ?? createdBy,
      updatedAt: new Date().toISOString()
    };

    if (storagePath) {
      updatePayload.storagePath = storagePath;
      updatePayload.fileName = fileNameFromPath(storagePath);
    }
    if (pageCount && pageCount > 0) {
      updatePayload.pageCount = pageCount;
    }
    if (defaultPageWidth && defaultPageWidth > 0) {
      updatePayload.defaultPageWidth = defaultPageWidth;
    }
    if (defaultPageHeight && defaultPageHeight > 0) {
      updatePayload.defaultPageHeight = defaultPageHeight;
    }

    return drawingClient
      .from("ballooningDrawing")
      .update(updatePayload)
      .eq("id", id)
      .select("id")
      .single();
  }

  if (!companyId) {
    return {
      data: null,
      error: { message: "companyId is required to create ballooning drawing" }
    };
  }

  if (!storagePath) {
    return {
      data: null,
      error: { message: "PDF upload is required to create ballooning diagram" }
    };
  }

  const qualityDocumentInsert = await client
    .from("qualityDocument")
    .insert({
      name,
      companyId,
      createdBy,
      tags: ["ballooning"],
      status: "Active",
      content: {}
    })
    .select("id")
    .single();

  if (qualityDocumentInsert.error || !qualityDocumentInsert.data?.id) {
    return {
      data: null,
      error:
        qualityDocumentInsert.error ??
        ({ message: "Failed to create quality document" } as const)
    };
  }

  return drawingClient
    .from("ballooningDrawing")
    .insert({
      companyId,
      qualityDocumentId: qualityDocumentInsert.data.id,
      drawingNumber: drawingNumber ?? name,
      revision: revision ?? null,
      version: 0,
      storagePath,
      fileName: fileNameFromPath(storagePath),
      ...(pageCount && pageCount > 0 ? { pageCount } : {}),
      ...(defaultPageWidth && defaultPageWidth > 0 ? { defaultPageWidth } : {}),
      ...(defaultPageHeight && defaultPageHeight > 0
        ? { defaultPageHeight }
        : {}),
      uploadedBy: createdBy,
      createdBy
    })
    .select("id")
    .single();
}

export async function deleteBallooningDiagram(
  client: SupabaseClient<Database>,
  id: string
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        eq: (
          column: string,
          value: unknown
        ) => Promise<{
          error: unknown;
        }>;
      };
    };
  };

  const existingResult = await drawingClient
    .from("ballooningDrawing")
    .select("*")
    .eq("id", id)
    .is("deletedAt", null)
    .single();

  if (!existingResult.data) {
    return {
      error: { message: "Ballooning drawing not found" }
    };
  }

  await client
    .from("qualityDocument")
    .update({
      status: "Archived",
      updatedAt: new Date().toISOString()
    })
    .eq("id", String(existingResult.data.qualityDocumentId));

  return drawingClient
    .from("ballooningDrawing")
    .update({ deletedAt: new Date().toISOString() })
    .eq("id", id);
}

export async function getBallooningSelectors(
  client: SupabaseClient<Database>,
  drawingId: string
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          is: (
            column: string,
            value: null
          ) => {
            order: (
              column: string,
              opts: { ascending: boolean }
            ) => Promise<{
              data: Record<string, unknown>[] | null;
              error: unknown;
            }>;
          };
        };
      };
    };
  };

  return drawingClient
    .from("ballooningSelector")
    .select("*")
    .eq("drawingId", drawingId)
    .is("deletedAt", null)
    .order("createdAt", { ascending: true });
}

export async function createBallooningSelectors(
  client: SupabaseClient<Database>,
  args: {
    drawingId: string;
    companyId: string;
    createdBy: string;
    selectors: {
      pageNumber: number;
      xCoordinate: number;
      yCoordinate: number;
      width: number;
      height: number;
    }[];
  }
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      insert: (payload: Record<string, unknown>[]) => {
        select: (columns: string) => Promise<{
          data: Record<string, unknown>[] | null;
          error: unknown;
        }>;
      };
    };
  };

  if (args.selectors.length === 0) {
    return { data: [], error: null };
  }

  return drawingClient
    .from("ballooningSelector")
    .insert(
      args.selectors.map((s) => ({
        drawingId: args.drawingId,
        companyId: args.companyId,
        pageNumber: s.pageNumber,
        xCoordinate: s.xCoordinate,
        yCoordinate: s.yCoordinate,
        width: s.width,
        height: s.height,
        createdBy: args.createdBy,
        updatedBy: args.createdBy
      }))
    )
    .select("*");
}

export async function updateBallooningSelectors(
  client: SupabaseClient<Database>,
  args: {
    drawingId: string;
    companyId: string;
    updatedBy: string;
    selectors: {
      id: string;
      pageNumber?: number;
      xCoordinate?: number;
      yCoordinate?: number;
      width?: number;
      height?: number;
    }[];
  }
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          select: (columns: string) => Promise<{
            data: Record<string, unknown>[] | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  if (args.selectors.length === 0) {
    return { data: [], error: null };
  }

  const updated: Record<string, unknown>[] = [];
  for (const selector of args.selectors) {
    const payload: Record<string, unknown> = {
      updatedBy: args.updatedBy,
      updatedAt: new Date().toISOString()
    };
    if (typeof selector.pageNumber === "number") {
      payload.pageNumber = selector.pageNumber;
    }
    if (typeof selector.xCoordinate === "number") {
      payload.xCoordinate = selector.xCoordinate;
    }
    if (typeof selector.yCoordinate === "number") {
      payload.yCoordinate = selector.yCoordinate;
    }
    if (typeof selector.width === "number") {
      payload.width = selector.width;
    }
    if (typeof selector.height === "number") {
      payload.height = selector.height;
    }

    const result = await drawingClient
      .from("ballooningSelector")
      .update(payload)
      .eq("id", selector.id)
      .eq("drawingId", args.drawingId)
      .eq("companyId", args.companyId)
      .select("*");

    if (result.error) {
      return { data: null, error: result.error };
    }
    if (result.data && result.data[0]) {
      updated.push(result.data[0]);
    }
  }

  return { data: updated, error: null };
}

export async function deleteBallooningSelectors(
  client: SupabaseClient<Database>,
  args: {
    drawingId: string;
    companyId: string;
    updatedBy: string;
    ids: string[];
  }
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        in: (
          column: string,
          values: string[]
        ) => {
          eq: (
            column: string,
            value: unknown
          ) => {
            eq: (
              column: string,
              value: unknown
            ) => {
              is: (
                column: string,
                value: null
              ) => Promise<{
                data: Record<string, unknown>[] | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };
  };

  if (args.ids.length === 0) {
    return { data: [], error: null };
  }

  return drawingClient
    .from("ballooningSelector")
    .update({
      deletedAt: new Date().toISOString(),
      updatedBy: args.updatedBy,
      updatedAt: new Date().toISOString()
    })
    .in("id", args.ids)
    .eq("drawingId", args.drawingId)
    .eq("companyId", args.companyId)
    .is("deletedAt", null)
    .select("id");
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

type BalloonRect = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function overlaps(a: BalloonRect, b: BalloonRect) {
  if (a.pageNumber !== b.pageNumber) return false;
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function inBounds(rect: BalloonRect) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= 1 &&
    rect.y + rect.height <= 1
  );
}

function clampRectToBounds(rect: BalloonRect): BalloonRect {
  const x = clamp01(Math.min(rect.x, 1 - rect.width));
  const y = clamp01(Math.min(rect.y, 1 - rect.height));
  return { ...rect, x, y };
}

export async function getBallooningBalloons(
  client: SupabaseClient<Database>,
  drawingId: string
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          is: (
            column: string,
            value: null
          ) => {
            order: (
              column: string,
              opts: { ascending: boolean }
            ) => Promise<{
              data: Record<string, unknown>[] | null;
              error: unknown;
              count?: number | null;
            }>;
            select?: never;
          };
          select?: never;
        };
      };
    };
  };

  return drawingClient
    .from("ballooningBalloon")
    .select("*")
    .eq("drawingId", drawingId)
    .is("deletedAt", null)
    .order("createdAt", { ascending: true });
}

export async function createBalloonsForSelectors(
  client: SupabaseClient<Database>,
  args: {
    drawingId: string;
    companyId: string;
    createdBy: string;
    selectors: {
      id: string;
      pageNumber: number;
      xCoordinate: number;
      yCoordinate: number;
      width: number;
      height: number;
    }[];
  }
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      select: (
        columns: string,
        opts?: { count?: "exact" }
      ) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          is: (
            column: string,
            value: null
          ) => Promise<{
            data: Record<string, unknown>[] | null;
            error: unknown;
            count?: number | null;
          }>;
        };
      };
      insert: (payload: Record<string, unknown>[]) => Promise<{
        data: Record<string, unknown>[] | null;
        error: unknown;
      }>;
    };
  };

  if (args.selectors.length === 0) {
    return { data: [], error: null };
  }

  const existing = await drawingClient
    .from("ballooningBalloon")
    .select("id, xCoordinate, yCoordinate, data", { count: "exact" })
    .eq("drawingId", args.drawingId)
    .is("deletedAt", null);

  if (existing.error) {
    return { data: null, error: existing.error };
  }

  let nextLabel = (existing.count ?? 0) + 1;
  const balloonWidth = 0.04;
  const balloonHeight = 0.04;
  const offset = 0.02;
  const occupied: BalloonRect[] = (existing.data ?? [])
    .map((b) => {
      const pageNumber = Number(
        (
          b.data as
            | {
                pageNumber?: unknown;
              }
            | null
            | undefined
        )?.pageNumber ?? 1
      );

      return {
        pageNumber,
        x: Number(b.xCoordinate ?? 0),
        y: Number(b.yCoordinate ?? 0),
        width: balloonWidth,
        height: balloonHeight
      };
    })
    .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y));

  return drawingClient.from("ballooningBalloon").insert(
    args.selectors.map((s) => {
      const anchorX = clamp01(s.xCoordinate + s.width / 2);
      const anchorY = clamp01(s.yCoordinate + s.height / 2);
      const candidates: BalloonRect[] = [
        {
          pageNumber: s.pageNumber,
          x: s.xCoordinate + s.width + offset,
          y: s.yCoordinate,
          width: balloonWidth,
          height: balloonHeight
        },
        {
          pageNumber: s.pageNumber,
          x: s.xCoordinate + s.width + offset,
          y: s.yCoordinate - balloonHeight - offset,
          width: balloonWidth,
          height: balloonHeight
        },
        {
          pageNumber: s.pageNumber,
          x: s.xCoordinate + s.width + offset,
          y: s.yCoordinate + s.height + offset,
          width: balloonWidth,
          height: balloonHeight
        },
        {
          pageNumber: s.pageNumber,
          x: s.xCoordinate,
          y: s.yCoordinate - balloonHeight - offset,
          width: balloonWidth,
          height: balloonHeight
        },
        {
          pageNumber: s.pageNumber,
          x: s.xCoordinate,
          y: s.yCoordinate + s.height + offset,
          width: balloonWidth,
          height: balloonHeight
        },
        {
          pageNumber: s.pageNumber,
          x: s.xCoordinate - balloonWidth - offset,
          y: s.yCoordinate,
          width: balloonWidth,
          height: balloonHeight
        }
      ];

      const placed =
        candidates.find(
          (candidate) =>
            inBounds(candidate) &&
            !occupied.some((other) => overlaps(candidate, other))
        ) ?? clampRectToBounds(candidates[0]!);

      occupied.push(placed);
      const label = String(nextLabel++);

      return {
        selectorId: s.id,
        drawingId: args.drawingId,
        companyId: args.companyId,
        label,
        xCoordinate: placed.x,
        yCoordinate: placed.y,
        anchorX,
        anchorY,
        data: {
          source: "selector-auto",
          pageNumber: s.pageNumber,
          placement: {
            width: balloonWidth,
            height: balloonHeight,
            offset
          },
          selector: {
            x: s.xCoordinate,
            y: s.yCoordinate,
            width: s.width,
            height: s.height
          }
        },
        createdBy: args.createdBy,
        updatedBy: args.createdBy
      };
    })
  );
}

export async function createBallooningBalloonsFromPayload(
  client: SupabaseClient<Database>,
  args: {
    drawingId: string;
    companyId: string;
    createdBy: string;
    selectorIdMap: Record<string, string>;
    balloons: Array<{
      tempSelectorId: string;
      label: string;
      xCoordinate: number;
      yCoordinate: number;
      anchorX: number;
      anchorY: number;
      data: Record<string, unknown>;
      description?: string | null;
    }>;
  }
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      insert: (payload: Record<string, unknown>[]) => Promise<{
        data: Record<string, unknown>[] | null;
        error: unknown;
      }>;
    };
  };

  if (args.balloons.length === 0) {
    return { data: [], error: null };
  }

  const rows = args.balloons.map((b) => {
    const selectorId = args.selectorIdMap[b.tempSelectorId];
    if (!selectorId) {
      return null;
    }
    return {
      selectorId,
      drawingId: args.drawingId,
      companyId: args.companyId,
      label: b.label,
      xCoordinate: b.xCoordinate,
      yCoordinate: b.yCoordinate,
      anchorX: b.anchorX,
      anchorY: b.anchorY,
      description: b.description ?? null,
      data: b.data,
      createdBy: args.createdBy,
      updatedBy: args.createdBy
    };
  });

  if (rows.some((r) => r === null)) {
    return {
      data: null,
      error: new Error("Missing selector mapping for one or more balloons")
    };
  }

  return drawingClient
    .from("ballooningBalloon")
    .insert(rows as Record<string, unknown>[]);
}

export async function updateBallooningBalloons(
  client: SupabaseClient<Database>,
  args: {
    drawingId: string;
    companyId: string;
    updatedBy: string;
    balloons: Array<{
      id: string;
      label?: string;
      xCoordinate?: number;
      yCoordinate?: number;
      anchorX?: number;
      anchorY?: number;
      data?: Record<string, unknown>;
      description?: string | null;
    }>;
  }
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          eq: (
            column: string,
            value: unknown
          ) => {
            eq: (
              column: string,
              value: unknown
            ) => {
              is: (
                column: string,
                value: null
              ) => Promise<{
                data: Record<string, unknown>[] | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };
  };

  if (args.balloons.length === 0) {
    return { data: [], error: null };
  }

  const updated: Record<string, unknown>[] = [];
  for (const b of args.balloons) {
    const payload: Record<string, unknown> = {
      updatedBy: args.updatedBy,
      updatedAt: new Date().toISOString()
    };
    if (typeof b.label === "string") payload.label = b.label;
    if (typeof b.xCoordinate === "number") payload.xCoordinate = b.xCoordinate;
    if (typeof b.yCoordinate === "number") payload.yCoordinate = b.yCoordinate;
    if (typeof b.anchorX === "number") payload.anchorX = b.anchorX;
    if (typeof b.anchorY === "number") payload.anchorY = b.anchorY;
    if (b.data !== undefined) payload.data = b.data;
    if (b.description !== undefined) payload.description = b.description;

    const result = await drawingClient
      .from("ballooningBalloon")
      .update(payload)
      .eq("id", b.id)
      .eq("drawingId", args.drawingId)
      .eq("companyId", args.companyId)
      .is("deletedAt", null)
      .select("*");

    if (result.error) {
      return { data: null, error: result.error };
    }
    if (result.data?.[0]) {
      updated.push(result.data[0]);
    }
  }

  return { data: updated, error: null };
}

export async function deleteBallooningBalloons(
  client: SupabaseClient<Database>,
  args: {
    drawingId: string;
    companyId: string;
    updatedBy: string;
    ids: string[];
  }
) {
  const drawingClient = client as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        in: (
          column: string,
          values: string[]
        ) => {
          eq: (
            column: string,
            value: unknown
          ) => {
            eq: (
              column: string,
              value: unknown
            ) => {
              is: (
                column: string,
                value: null
              ) => Promise<{
                data: Record<string, unknown>[] | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };
  };

  if (args.ids.length === 0) {
    return { data: [], error: null };
  }

  return drawingClient
    .from("ballooningBalloon")
    .update({
      deletedAt: new Date().toISOString(),
      updatedBy: args.updatedBy,
      updatedAt: new Date().toISOString()
    })
    .in("id", args.ids)
    .eq("drawingId", args.drawingId)
    .eq("companyId", args.companyId)
    .is("deletedAt", null)
    .select("id");
}
