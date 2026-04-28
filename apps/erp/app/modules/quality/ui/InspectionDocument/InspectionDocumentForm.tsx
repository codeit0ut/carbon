import { useCarbon } from "@carbon/auth";
import { ValidatedForm } from "@carbon/form";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  toast,
  VStack
} from "@carbon/react";
import { useLingui } from "@lingui/react/macro";
import { nanoid } from "nanoid";
import { type ChangeEvent, useRef, useState } from "react";
import { LuLoader, LuUpload } from "react-icons/lu";
import { Hidden, Input, Item, Submit } from "~/components/Form";
import { useUser } from "~/hooks";
import { inspectionDocumentValidator } from "~/modules/quality/quality.models";
import { path } from "~/utils/path";

type InspectionDocumentFormProps = {
  initialValues: {
    id?: string;
    name: string;
    partId: string;
    drawingNumber?: string;
    revision?: string;
  };
  onClose: () => void;
};

export default function InspectionDocumentForm({
  initialValues,
  onClose
}: InspectionDocumentFormProps) {
  const { t } = useLingui();
  const { carbon } = useCarbon();
  const user = useUser();
  const isEditing = Boolean(initialValues.id);
  const [pdfUrl, setPdfUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !carbon) return;

    setUploading(true);
    const tempId = initialValues.id ?? nanoid();
    const storagePath = `${user.company.id}/inspectionDocument/${tempId}/${nanoid()}.pdf`;
    const result = await carbon.storage
      .from("private")
      .upload(storagePath, file);
    setUploading(false);

    if (result.error) {
      toast.error(t`Failed to upload PDF`);
      return;
    }

    setPdfUrl(`/file/preview/private/${result.data.path}`);
    toast.success(t`PDF uploaded`);
  };

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <ValidatedForm
          validator={inspectionDocumentValidator}
          method="post"
          action={
            isEditing
              ? path.to.inspectionDocument(initialValues.id!)
              : path.to.newInspectionDocument
          }
          defaultValues={initialValues}
          className="flex flex-col h-full"
        >
          <DrawerHeader>
            <DrawerTitle>
              {isEditing
                ? t`Edit Inspection Document`
                : t`New Inspection Document`}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={4}>
              {isEditing && <Hidden name="id" />}
              <Hidden name="pdfUrl" value={pdfUrl} />
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
                disabled={uploading}
              />
              <Input
                name="name"
                label={t`Name`}
                placeholder={t`e.g. Part 1234 Rev A`}
              />
              <Item name="partId" type="Part" />
              <Input
                name="drawingNumber"
                label={t`Drawing Number`}
                placeholder={t`e.g. DWG-1234`}
              />
              <Input
                name="revision"
                label={t`Revision`}
                placeholder={t`e.g. A`}
              />
              {!isEditing && (
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={uploading ? <LuLoader /> : <LuUpload />}
                  onClick={() => fileInputRef.current?.click()}
                  isDisabled={uploading}
                >
                  {uploading
                    ? t`Uploading PDF...`
                    : pdfUrl
                      ? t`Replace PDF`
                      : t`Upload PDF (Required)`}
                </Button>
              )}
            </VStack>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose}>
              {t`Cancel`}
            </Button>
            <Submit isDisabled={!isEditing && (!pdfUrl || uploading)}>
              {isEditing ? t`Save` : t`Create`}
            </Submit>
          </DrawerFooter>
        </ValidatedForm>
      </DrawerContent>
    </Drawer>
  );
}
