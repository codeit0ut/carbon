import { ValidatedForm } from "@carbon/form";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  VStack
} from "@carbon/react";
import { useLingui } from "@lingui/react/macro";
import { Hidden, Input, Submit } from "~/components/Form";
import { ballooningDiagramValidator } from "~/modules/quality/quality.models";
import { path } from "~/utils/path";

type BallooningFormProps = {
  initialValues: {
    id?: string;
    name: string;
    drawingNumber?: string;
    revision?: string;
  };
  onClose: () => void;
};

export default function BallooningForm({
  initialValues,
  onClose
}: BallooningFormProps) {
  const { t } = useLingui();
  const isEditing = Boolean(initialValues.id);

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <ValidatedForm
          validator={ballooningDiagramValidator}
          method="post"
          action={
            isEditing
              ? path.to.ballooningDiagram(initialValues.id!)
              : path.to.newBallooningDiagram
          }
          defaultValues={initialValues}
          className="flex flex-col h-full"
        >
          <DrawerHeader>
            <DrawerTitle>
              {isEditing
                ? t`Edit Ballooning Diagram`
                : t`New Ballooning Diagram`}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={4}>
              {isEditing && <Hidden name="id" />}
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
          </DrawerBody>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose}>
              {t`Cancel`}
            </Button>
            <Submit>{isEditing ? t`Save` : t`Create`}</Submit>
          </DrawerFooter>
        </ValidatedForm>
      </DrawerContent>
    </Drawer>
  );
}
