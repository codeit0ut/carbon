import { useCarbon } from "@carbon/auth";
import { ValidatedForm } from "@carbon/form";
import {
  Button,
  CardHeader,
  CardTitle,
  cn,
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
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { LuCloudUpload, LuLoader } from "react-icons/lu";
import { Hidden, Input, Submit } from "~/components/Form";
import { useUser } from "~/hooks";
import { balloonDocumentValidator } from "~/modules/quality/quality.models";
import { path } from "~/utils/path";

type BalloonDocumentFormProps = {
  initialValues: {
    id?: string;
    name: string;
    drawingNumber?: string;
    revision?: string;
  };
  onClose: () => void;
};

export default function BalloonDocumentForm({
  initialValues,
  onClose
}: BalloonDocumentFormProps) {
  const { t } = useLingui();
  const { carbon } = useCarbon();
  const user = useUser();
  const isEditing = Boolean(initialValues.id);
  const [pdfUrl, setPdfUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"details" | "pdf">("details");

  const uploadPdf = useCallback(
    async (file: File | undefined) => {
      if (!file || !carbon) return;

      setUploading(true);
      const tempId = initialValues.id ?? nanoid();
      const storagePath = `${user.company.id}/balloonDocument/${tempId}/${nanoid()}.pdf`;
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
    },
    [carbon, initialValues.id, t, user.company.id]
  );

  const { getRootProps, getInputProps } = useDropzone({
    disabled: isEditing || uploading,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"]
    },
    onDropAccepted: (acceptedFiles) => {
      void uploadPdf(acceptedFiles[0]);
    },
    onDropRejected: () => {
      toast.error(t`Please upload a valid PDF file`);
    }
  });

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <ValidatedForm
          validator={balloonDocumentValidator}
          method="post"
          action={
            isEditing
              ? path.to.balloonDocument(initialValues.id!)
              : path.to.newBalloonDocument
          }
          defaultValues={initialValues}
          className="flex flex-col h-full"
        >
          <DrawerHeader>
            <DrawerTitle>
              {isEditing ? t`Edit Balloon Document` : t`New Balloon Document`}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={4}>
              {isEditing && <Hidden name="id" />}
              <Hidden name="pdfUrl" value={pdfUrl} />
              <div className={cn(!isEditing && step === "pdf" && "hidden")}>
                <VStack spacing={4}>
                  <Input
                    name="name"
                    label={t`Name`}
                    placeholder={t`e.g. Part 1234 Rev A`}
                  />
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
                </VStack>
              </div>

              {!isEditing && step === "pdf" && (
                <div
                  {...getRootProps()}
                  className={cn(
                    "group flex flex-col rounded-lg border border-border bg-gradient-to-bl from-card from-50% via-card to-background text-card-foreground shadow-sm w-full min-h-[280px] border-2 border-dashed",
                    !uploading &&
                      "cursor-pointer hover:border-primary/30 hover:to-primary/10",
                    uploading && "cursor-not-allowed opacity-80"
                  )}
                >
                  <input {...getInputProps()} name="pdf" className="sr-only" />
                  <div className="flex flex-col h-full w-full p-4">
                    <CardHeader>
                      <CardTitle>{t`PDF Document`}</CardTitle>
                    </CardHeader>
                    <div className="flex flex-col flex-grow items-center justify-center gap-2 p-6">
                      {uploading ? (
                        <LuLoader className="h-12 w-12 text-muted-foreground animate-spin" />
                      ) : (
                        <div className="p-4 bg-accent rounded-full group-hover:bg-primary">
                          <LuCloudUpload className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary-foreground" />
                        </div>
                      )}
                      <p className="text-base text-muted-foreground group-hover:text-foreground mt-6">
                        {uploading
                          ? t`Uploading PDF...`
                          : t`Choose file to upload or drag and drop`}
                      </p>
                      <p className="text-xs text-muted-foreground group-hover:text-foreground">
                        {pdfUrl
                          ? t`PDF uploaded. Click or drop to replace.`
                          : t`Supports .pdf files`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </VStack>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose}>
              {t`Cancel`}
            </Button>
            {!isEditing && step === "details" && (
              <Button type="button" onClick={() => setStep("pdf")}>
                {t`Next`}
              </Button>
            )}
            {!isEditing && step === "pdf" && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep("details")}
              >
                {t`Back`}
              </Button>
            )}
            {(isEditing || step === "pdf") && (
              <Submit isDisabled={!isEditing && (!pdfUrl || uploading)}>
                {isEditing ? t`Save` : t`Create`}
              </Submit>
            )}
          </DrawerFooter>
        </ValidatedForm>
      </DrawerContent>
    </Drawer>
  );
}
