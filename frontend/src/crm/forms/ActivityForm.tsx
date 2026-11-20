import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { type UseFormRegister, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  DialogBody,
  DialogFooter,
  FormDialog,
  LoadingBody,
} from "../../components/dialogs/FormDialog";
import { SelectField, TextAreaField, TextField } from "../../components/fields/Field";
import { parseDateTime, toDateTimeInput, toISODateTime } from "../../lib/dates";
import {
  type Activity,
  type ActivityType,
  type ContactRow,
  type Deal,
  type Link,
  useContacts,
  useDeals,
  useSaveActivity,
} from "../api";
import { type ActivityValues, activitySchema } from "./schemas";
import { placeServerErrors } from "./serverErrors";

/** The record whose page the activity is logged from. That link is fixed. */
export type LoggedOn =
  | { kind: "contact"; id: number; name: string; organization: Link }
  | { kind: "deal"; id: number; name: string; organization: Link };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  on: LoggedOn;
  activity?: Activity;
};

const TYPES: { value: ActivityType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "note", label: "Note" },
];

export function ActivityForm({ open, onOpenChange, on, activity }: Props) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={activity ? "Edit activity" : "Log activity"}
      description={`On ${on.name}`}
    >
      <ActivityFields on={on} activity={activity} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

const ORDER = ["type", "description", "occurred_at", "follow_up_date", "second_link"] as const;

type FieldsProps = { on: LoggedOn; activity?: Activity; onDone: () => void };

function ActivityFields(props: FieldsProps) {
  const deals = useDeals().data;
  const contacts = useContacts().data;
  if (!deals || !contacts) return <LoadingBody />;
  return <ActivityFieldsReady {...props} deals={deals} contacts={contacts} />;
}

type SecondLink = { kind: "deal" | "contact"; current?: Link; options: Link[] };

// The second link: a deal at the contact's organization, or a contact at the deal's.
function secondLinkFor(
  on: LoggedOn,
  activity: Activity | undefined,
  deals: Deal[],
  contacts: ContactRow[],
): SecondLink {
  const kind = on.kind === "contact" ? "deal" : "contact";
  const current = on.kind === "contact" ? activity?.deal : activity?.contact;
  const records: (Link & { organization: Link })[] = kind === "deal" ? deals : contacts;
  const atOrganization = records
    .filter((r) => r.organization.id === on.organization.id)
    .map((r) => ({ id: r.id, name: r.name }));
  // An existing link stays on offer, even if that record has since moved organization.
  const options =
    current && !atOrganization.some((o) => o.id === current.id)
      ? [current, ...atOrganization]
      : atOrganization;
  return { kind, current: current ?? undefined, options };
}

function activityDefaults(activity: Activity | undefined, current?: Link): ActivityValues {
  if (!activity) {
    return {
      type: "call",
      description: "",
      occurred_at: toDateTimeInput(new Date()),
      follow_up_date: "",
      second_link: "",
    };
  }
  return {
    type: activity.type,
    description: activity.description,
    occurred_at: toDateTimeInput(parseDateTime(activity.occurred_at)),
    follow_up_date: activity.follow_up_date ?? "",
    second_link: current ? String(current.id) : "",
  };
}

function serverLinkError(error: unknown, kind: SecondLink["kind"]): string | undefined {
  return (error as { fieldErrors?: Record<string, string> }).fieldErrors?.[`${kind}_id`];
}

function ActivityFieldsReady({
  on,
  activity,
  onDone,
  deals,
  contacts,
}: FieldsProps & { deals: Deal[]; contacts: ContactRow[] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveActivity(activity?.id);
  const secondLink = secondLinkFor(on, activity, deals, contacts);

  const form = useForm<ActivityValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: activityDefaults(activity, secondLink.current),
  });
  const { register, handleSubmit, formState } = form;
  const errors = formState.errors;

  // Start on the first field, also when the form mounts after its lists load.
  useEffect(() => {
    form.setFocus("type");
  }, [form]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const second = values.second_link ? Number(values.second_link) : null;
    try {
      await save.mutateAsync({
        type: values.type,
        description: values.description,
        occurred_at: toISODateTime(parseDateTime(values.occurred_at)),
        follow_up_date: values.follow_up_date || null,
        done: activity?.done ?? false,
        contact_id: on.kind === "contact" ? on.id : second,
        deal_id: on.kind === "deal" ? on.id : second,
      });
      toast.success(activity ? "Saved the activity." : "Logged the activity.");
      onDone();
    } catch (error) {
      const message = placeServerErrors(error, form, [...ORDER]);
      const linkError = serverLinkError(error, secondLink.kind);
      if (linkError) form.setError("second_link", { type: "server", message: linkError });
      setFormError(linkError ? null : message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogBody error={formError}>
        <TypeField register={register} error={errors.type?.message} />
        <TextAreaField
          label="Description"
          {...register("description")}
          error={errors.description?.message}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="When it happened"
            type="datetime-local"
            {...register("occurred_at")}
            error={errors.occurred_at?.message}
          />
          <TextField
            label="Follow-up date"
            optional
            type="date"
            {...register("follow_up_date")}
            error={errors.follow_up_date?.message}
          />
        </div>
        <SecondLinkField
          secondLink={secondLink}
          organizationName={on.organization.name}
          register={register}
          error={errors.second_link?.message}
        />
      </DialogBody>
      <DialogFooter
        submitLabel={activity ? "Save" : "Log activity"}
        submitting={formState.isSubmitting}
      />
    </form>
  );
}

type FieldProps = { register: UseFormRegister<ActivityValues>; error?: string };

function TypeField({ register, error }: FieldProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[14px] font-semibold">Type</legend>
      <div className="flex gap-2">
        {TYPES.map((type) => (
          <label
            key={type.value}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-field-border px-3.5 text-[14.5px] has-[:checked]:border-ink has-[:checked]:bg-nav-current has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-info-strong"
          >
            <input type="radio" value={type.value} className="sr-only" {...register("type")} />
            {type.label}
          </label>
        ))}
      </div>
      {error ? <p className="mt-1.5 text-[13px] font-medium text-alert-strong">{error}</p> : null}
    </fieldset>
  );
}

function SecondLinkField({
  secondLink,
  organizationName,
  register,
  error,
}: FieldProps & { secondLink: SecondLink; organizationName: string }) {
  const { kind, options } = secondLink;
  const noneToLink =
    kind === "deal"
      ? `${organizationName} has no deals to link.`
      : `${organizationName} has no other contacts to link.`;
  return (
    <SelectField
      label={kind === "deal" ? "Also link to a deal" : "Also link to a contact"}
      optional
      {...register("second_link")}
      error={error}
      hint={options.length === 0 ? noneToLink : null}
    >
      <option value="">None</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </SelectField>
  );
}
