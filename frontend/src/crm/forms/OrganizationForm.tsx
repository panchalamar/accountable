import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DialogBody, DialogFooter, FormDialog } from "../../components/dialogs/FormDialog";
import { TextAreaField, TextField } from "../../components/fields/Field";
import { type Organization, useOrganizations, useSaveOrganization } from "../api";
import { type OrganizationValues, organizationSchema } from "./schemas";
import { placeServerErrors } from "./serverErrors";

type Existing = Pick<Organization, "id" | "name" | "website" | "industry"> & {
  notes?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: Existing;
  onSaved?: (organization: Organization) => void;
};

export function OrganizationForm({ open, onOpenChange, organization, onSaved }: Props) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={organization ? `Edit ${organization.name}` : "Add organization"}
    >
      <OrganizationFields
        organization={organization}
        onDone={(saved) => {
          onOpenChange(false);
          onSaved?.(saved);
        }}
      />
    </FormDialog>
  );
}

function organizationDefaults(organization?: Existing): OrganizationValues {
  return {
    name: organization?.name ?? "",
    website: organization?.website ?? "",
    industry: organization?.industry ?? "",
    notes: organization?.notes ?? "",
  };
}

function OrganizationFields({
  organization,
  onDone,
}: {
  organization?: Existing;
  onDone: (o: Organization) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveOrganization(organization?.id);
  const industries = [
    ...new Set((useOrganizations().data ?? []).map((o) => o.industry).filter(Boolean)),
  ].sort() as string[];
  const form = useForm<OrganizationValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: organizationDefaults(organization),
  });
  const { register, handleSubmit, formState } = form;
  const errors = formState.errors;

  // Start on the first field, also when the form mounts after its lists load.
  useEffect(() => {
    form.setFocus("name");
  }, [form]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync(values);
      toast.success(organization ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
      onDone(saved);
    } catch (error) {
      setFormError(placeServerErrors(error, form, ["name", "website", "industry", "notes"]));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogBody error={formError}>
        <TextField
          label="Name"
          autoComplete="off"
          {...register("name")}
          error={errors.name?.message}
        />
        <TextField
          label="Website"
          optional
          autoComplete="off"
          placeholder="www.company.com"
          {...register("website")}
          error={errors.website?.message}
        />
        <TextField
          label="Industry"
          optional
          autoComplete="off"
          list="industries-in-use"
          {...register("industry")}
          error={errors.industry?.message}
        />
        <datalist id="industries-in-use">
          {industries.map((industry) => (
            <option key={industry} value={industry} />
          ))}
        </datalist>
        <TextAreaField
          label="Notes"
          optional
          {...register("notes")}
          error={errors.notes?.message}
        />
      </DialogBody>
      <DialogFooter
        submitLabel={organization ? "Save" : "Add organization"}
        submitting={formState.isSubmitting}
      />
    </form>
  );
}
