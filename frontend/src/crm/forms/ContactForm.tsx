import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  DialogBody,
  DialogFooter,
  FormDialog,
  LoadingBody,
} from "../../components/dialogs/FormDialog";
import { SelectField, TextField } from "../../components/fields/Field";
import {
  type Contact,
  type ContactRow,
  type OrganizationRow,
  useOrganizations,
  useSaveContact,
} from "../api";
import { STATUSES, STATUS_LABEL } from "../lib/stages";
import { type ContactValues, contactSchema } from "./schemas";
import { placeServerErrors } from "./serverErrors";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: ContactRow;
  /** For "Add contact" on an organization's page. */
  organizationId?: number;
  onSaved?: (contact: Contact) => void;
};

export function ContactForm({ open, onOpenChange, contact, organizationId, onSaved }: Props) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={contact ? `Edit ${contact.name}` : "Add contact"}
    >
      <ContactFields
        contact={contact}
        organizationId={organizationId}
        onDone={(saved) => {
          onOpenChange(false);
          onSaved?.(saved);
        }}
      />
    </FormDialog>
  );
}

const ORDER = ["name", "organization_id", "email", "phone", "job_title", "status"] as const;

type FieldsProps = { contact?: ContactRow; organizationId?: number; onDone: (c: Contact) => void };

function ContactFields(props: FieldsProps) {
  const organizations = useOrganizations().data;
  if (!organizations) return <LoadingBody />;
  return <ContactFieldsReady {...props} organizations={organizations} />;
}

function contactDefaults(contact?: ContactRow, organizationId?: number): ContactValues {
  return {
    name: contact?.name ?? "",
    organization_id: String(contact?.organization.id ?? organizationId ?? ""),
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    job_title: contact?.job_title ?? "",
    status: contact?.status ?? "lead",
  };
}

function ContactFieldsReady({
  contact,
  organizationId,
  onDone,
  organizations,
}: FieldsProps & { organizations: OrganizationRow[] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveContact(contact?.id);
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: contactDefaults(contact, organizationId),
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
      const saved = await save.mutateAsync({
        ...values,
        organization_id: Number(values.organization_id),
      });
      toast.success(contact ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
      onDone(saved);
    } catch (error) {
      setFormError(placeServerErrors(error, form, [...ORDER]));
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
        <SelectField
          label="Organization"
          {...register("organization_id")}
          error={errors.organization_id?.message}
        >
          <option value="">Choose an organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Email"
          optional
          type="email"
          autoComplete="off"
          {...register("email")}
          error={errors.email?.message}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Phone"
            optional
            autoComplete="off"
            {...register("phone")}
            error={errors.phone?.message}
          />
          <TextField
            label="Job title"
            optional
            autoComplete="off"
            {...register("job_title")}
            error={errors.job_title?.message}
          />
        </div>
        <SelectField label="Status" {...register("status")} error={errors.status?.message}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </SelectField>
      </DialogBody>
      <DialogFooter
        submitLabel={contact ? "Save" : "Add contact"}
        submitting={formState.isSubmitting}
      />
    </form>
  );
}
