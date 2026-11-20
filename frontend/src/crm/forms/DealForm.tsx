import { zodResolver } from "@hookform/resolvers/zod";
import { addDays } from "date-fns";
import { useEffect, useState } from "react";
import { type UseFormRegister, useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";

import {
  DialogBody,
  DialogFooter,
  FormDialog,
  LoadingBody,
} from "../../components/dialogs/FormDialog";
import { SelectField, TextField } from "../../components/fields/Field";
import { formatDate, toISODate, today } from "../../lib/dates";
import {
  type ContactRow,
  type Deal,
  type OrganizationRow,
  useContacts,
  useOrganizations,
  useSaveDeal,
} from "../api";
import { STAGES, STAGE_LABEL, STAGE_PROBABILITY, type Stage, isClosed } from "../lib/stages";
import { type DealValues, dealSchema, parseMoney } from "./schemas";
import { placeServerErrors } from "./serverErrors";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal;
  /** For "Add deal" on an organization's page. */
  organizationId?: number;
  /** For "Add deal" in a board column. */
  stage?: Stage;
  onSaved?: (deal: Deal) => void;
};

export function DealForm({ open, onOpenChange, deal, organizationId, stage, onSaved }: Props) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={deal ? `Edit ${deal.name}` : "Add deal"}
    >
      <DealFields
        deal={deal}
        organizationId={organizationId}
        stage={stage}
        onClose={() => onOpenChange(false)}
        onDone={(saved) => {
          onOpenChange(false);
          onSaved?.(saved);
        }}
      />
    </FormDialog>
  );
}

const ORDER = [
  "name",
  "organization_id",
  "main_contact_id",
  "stage",
  "value",
  "probability",
  "close_date",
] as const;

type StageNotes = {
  probabilityNote: string | null;
  probabilityLocked: boolean;
  closeLabel: string;
  closeLocked: boolean;
  closeNote: string | null;
};

/**
 * What the form shows for the chosen stage, before saving. The server applies
 * the same rules, so what the form says is what happens.
 */
export function stageNotes(original: Stage | null, chosen: Stage): StageNotes {
  const adding = original === null;
  const changed = !adding && chosen !== original;
  const closing = isClosed(chosen) && (adding || changed);
  const reopening = changed && isClosed(original as Stage) && !isClosed(chosen);
  return {
    probabilityNote: changed ? `Probability will be set to ${STAGE_PROBABILITY[chosen]}%` : null,
    probabilityLocked: changed,
    closeLabel: reopening ? "New expected close date" : "Close date",
    closeLocked: closing,
    closeNote: closing ? "The close date will be set to today." : null,
  };
}

type FieldsProps = {
  deal?: Deal;
  organizationId?: number;
  stage?: Stage;
  onClose: () => void;
  onDone: (d: Deal) => void;
};

// The selects can only show a saved choice once their options are there, so
// the form mounts after the organizations and contacts have loaded.
function DealFields(props: FieldsProps) {
  const organizations = useOrganizations().data;
  const contacts = useContacts().data;
  if (!organizations || !contacts) return <LoadingBody />;
  return <DealFieldsReady {...props} organizations={organizations} contacts={contacts} />;
}

function dealDefaults(deal: Deal | undefined, organizationId?: number, stage?: Stage): DealValues {
  const startStage: Stage = deal?.stage ?? stage ?? "new";
  if (deal) {
    return {
      name: deal.name,
      organization_id: String(deal.organization.id),
      main_contact_id: String(deal.main_contact.id),
      stage: startStage,
      value: String(deal.value),
      probability: String(deal.probability),
      close_date: deal.close_date,
    };
  }
  return {
    name: "",
    organization_id: String(organizationId ?? ""),
    main_contact_id: "",
    stage: startStage,
    value: "",
    probability: String(STAGE_PROBABILITY[startStage]),
    close_date: isClosed(startStage) ? toISODate(today()) : "",
  };
}

/**
 * The close date to show after the stage changes from `previous` to `next`,
 * or undefined to leave it as it is.
 */
function closeDateForStage(next: Stage, previous: Stage, deal?: Deal): string | undefined {
  if (isClosed(next)) return toISODate(today());
  if (!deal) return isClosed(previous) ? "" : undefined;
  if (isClosed(deal.stage)) return toISODate(addDays(today(), 30));
  return deal.close_date;
}

function savedMessage(saved: Deal, deal?: Deal): string {
  if (!deal) return `Added ${saved.name}.`;
  if (saved.stage !== deal.stage) return `Moved ${saved.name} to ${STAGE_LABEL[saved.stage]}.`;
  return `Saved ${saved.name}.`;
}

function DealFieldsReady({
  deal,
  organizationId,
  stage,
  onClose,
  onDone,
  organizations,
  contacts,
}: FieldsProps & { organizations: OrganizationRow[]; contacts: ContactRow[] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveDeal(deal?.id);

  const form = useForm<DealValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: dealDefaults(deal, organizationId, stage),
  });
  const { register, handleSubmit, formState, control, setValue } = form;
  const errors = formState.errors;

  // Start on the first field, also when the form mounts after its lists load.
  useEffect(() => {
    form.setFocus("name");
  }, [form]);

  const orgId = useWatch({ control, name: "organization_id" });
  const chosenStage = useWatch({ control, name: "stage" }) as Stage;
  const notes = stageNotes(deal ? deal.stage : null, chosenStage);

  function chooseStage(next: Stage) {
    if (deal && next === deal.stage) {
      // Back to where it started: the deal's own figures, editable again.
      setValue("probability", String(deal.probability));
      setValue("close_date", deal.close_date);
      return;
    }
    setValue("probability", String(STAGE_PROBABILITY[next]));
    const closeDate = closeDateForStage(next, chosenStage, deal);
    if (closeDate !== undefined) setValue("close_date", closeDate);
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        name: values.name,
        organization_id: Number(values.organization_id),
        main_contact_id: Number(values.main_contact_id),
        stage: values.stage,
        value: parseMoney(values.value),
        probability: Number(values.probability),
        close_date: values.close_date,
      });
      toast.success(savedMessage(saved, deal));
      onDone(saved);
    } catch (error) {
      setFormError(placeServerErrors(error, form, [...ORDER]));
    }
  });

  const organizationField = register("organization_id");
  const stageField = register("stage");

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
          {...organizationField}
          onChange={(event) => {
            void organizationField.onChange(event);
            // The main contact has to be at the deal's organization.
            setValue("main_contact_id", "");
          }}
          error={errors.organization_id?.message}
        >
          <option value="">Choose an organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </SelectField>
        <MainContactField
          orgId={orgId}
          organization={organizations.find((o) => String(o.id) === orgId)}
          choices={contacts.filter((c) => String(c.organization.id) === orgId)}
          register={register}
          error={errors.main_contact_id?.message}
          onClose={onClose}
        />
        <SelectField
          label="Stage"
          {...stageField}
          onChange={(event) => {
            void stageField.onChange(event);
            chooseStage(event.target.value as Stage);
          }}
          error={errors.stage?.message}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Value ($)"
            inputMode="numeric"
            autoComplete="off"
            placeholder="250000"
            {...register("value")}
            error={errors.value?.message}
          />
          <TextField
            label="Probability (%)"
            inputMode="numeric"
            autoComplete="off"
            readOnly={notes.probabilityLocked}
            {...register("probability")}
            error={errors.probability?.message}
            hint={notes.probabilityNote}
          />
        </div>
        <TextField
          label={notes.closeLabel}
          type="date"
          readOnly={notes.closeLocked}
          {...register("close_date")}
          error={errors.close_date?.message}
          hint={notes.closeNote ? `${notes.closeNote} Today is ${formatDate(today())}.` : null}
        />
      </DialogBody>
      <DialogFooter submitLabel={deal ? "Save" : "Add deal"} submitting={formState.isSubmitting} />
    </form>
  );
}

type MainContactProps = {
  orgId: string;
  organization?: OrganizationRow;
  choices: ContactRow[];
  register: UseFormRegister<DealValues>;
  error?: string;
  onClose: () => void;
};

function MainContactField({
  orgId,
  organization,
  choices,
  register,
  error,
  onClose,
}: MainContactProps) {
  const noContacts = Boolean(orgId) && choices.length === 0;
  return (
    <SelectField
      label="Main contact"
      {...register("main_contact_id")}
      disabled={!orgId || noContacts}
      error={error}
      hint={
        noContacts && organization ? (
          <NoContactsHint organization={organization} onClose={onClose} />
        ) : !orgId ? (
          "Choose an organization first."
        ) : null
      }
    >
      <option value="">{orgId ? "Choose a main contact" : "Choose an organization first"}</option>
      {choices.map((contact) => (
        <option key={contact.id} value={contact.id}>
          {contact.name}
        </option>
      ))}
    </SelectField>
  );
}

function NoContactsHint({
  organization,
  onClose,
}: {
  organization: OrganizationRow;
  onClose: () => void;
}) {
  return (
    <>
      {organization.name} has no contacts yet. Add a contact first.{" "}
      <Link
        to={`/organizations/${organization.id}`}
        state={{ addContact: true }}
        className="link font-medium"
        onClick={onClose}
      >
        Add a contact at {organization.name}
      </Link>
    </>
  );
}
