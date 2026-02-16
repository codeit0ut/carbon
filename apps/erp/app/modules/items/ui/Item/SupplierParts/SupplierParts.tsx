import { MenuIcon, MenuItem } from "@carbon/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { LuPencil } from "react-icons/lu";
import { Outlet, useNavigate } from "react-router";
import { New, SupplierAvatar } from "~/components";
import Table from "~/components/Table";
import { useCurrencyFormatter } from "~/hooks";
import { useCustomColumns } from "~/hooks/useCustomColumns";
import type { SupplierPart } from "../../../types";
import useSupplierParts from "./useSupplierParts";

type Part = Pick<
  SupplierPart,
  | "id"
  | "supplierId"
  | "supplierPartId"
  | "unitPrice"
  | "supplierUnitOfMeasureCode"
  | "minimumOrderQuantity"
  | "conversionFactor"
  | "customFields"
  | "lastPurchaseDate"
  | "lastPOQuantity"
>;

type SupplierPartsProps = {
  supplierParts: Part[];
  compact?: boolean;
};

const SupplierParts = ({
  supplierParts,
  compact = false
}: SupplierPartsProps) => {
  const navigate = useNavigate();
  const { canEdit } = useSupplierParts();

  const formatter = useCurrencyFormatter();
  const customColumns = useCustomColumns<Part>("supplierPart");

  const columns = useMemo<ColumnDef<Part>[]>(() => {
    const defaultColumns: ColumnDef<Part>[] = [
      {
        accessorKey: "supplierId",
        header: "Supplier",
        cell: ({ row }) => (
          <SupplierAvatar supplierId={row.original.supplierId} />
        )
      },
      {
        accessorKey: "supplierPartId",
        header: "Supplier ID",
        cell: (item) => item.getValue()
      },
      {
        accessorKey: "unitPrice",
        header: "Unit Price",
        cell: (item) => formatter.format(item.getValue<number>()),
        meta: {
          formatter: formatter.format,
          renderTotal: true
        }
      },
      {
        accessorKey: "lastPurchaseDate",
        header: "Last Purchase",
        cell: (item) => {
          const date = item.getValue<string>();
          if (!date) return "—";
          return new Date(date).toLocaleDateString();
        }
      },
      {
        accessorKey: "lastPOQuantity",
        header: "Last PO Qty",
        cell: (item) => {
          const qty = item.getValue<number>();
          if (qty == null) return "—";
          return qty.toLocaleString();
        }
      },
      {
        accessorKey: "supplierUnitOfMeasureCode",
        header: "Unit of Measure",
        cell: (item) => item.getValue()
      },
      {
        accessorKey: "minimumOrderQuantity",
        header: "Minimum Order Quantity",
        cell: (item) => item.getValue()
      },
      {
        accessorKey: "conversionFactor",
        header: "Conversion Factor",
        cell: (item) => item.getValue()
      }
    ];
    return [...defaultColumns, ...customColumns];
  }, [customColumns, formatter]);

  const renderContextMenu = useCallback(
    (row: Part) => (
      <MenuItem onClick={() => navigate(row.id!)}>
        <MenuIcon icon={<LuPencil />} />
        Edit Supplier Part
      </MenuItem>
    ),
    [navigate]
  );

  return (
    <>
      <Table<Part>
        data={supplierParts}
        columns={columns}
        count={supplierParts.length}
        title="Supplier Parts"
        renderContextMenu={canEdit ? renderContextMenu : undefined}
        primaryAction={
          canEdit ? <New label="Supplier Part" to="new" /> : undefined
        }
      />
      <Outlet />
    </>
  );
};

export default SupplierParts;
