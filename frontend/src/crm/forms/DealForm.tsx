import { zodResolver } from "@hookform/resolvers/zod";
import { addDays } from "date-fns";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";

import { DialogBody, DialogFooter, FormDialog, LoadingBody } from "../../components/dialogs/FormDialog";
import { SelectField, TextField } from "../../components/fields/Field";
import { formatDate, toISODate, today } from "../../lib/dates";
import { type ContactRow, type Deal, type OrganizationRow, useContacts, useOrganizations, useSaveDeal } from "../api";
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
    <FormDialog open={open} onOpenChange={onOpenChange} title={deal ? `Edit ${deal.name}` : "Add deal"}>
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

const ORDER = ["name", "organization_id", "main_contact_id", "stage", "value", "probability", "close_date"] as const;

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
  const startStage: Stage = deal?.stage ?? stage ?? "new";
  const original = deal ? deal.stage : null;
  const todayISO = toISODate(today());

  const form = useForm<DealValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: deal?.name ?? "",
      organization_id: String(deal?.organization.id ?? organizationId ?? ""),
      main_contact_id: deal ? String(deal.main_contact.id) : "",
      stage: startStage,
      value: deal ? String(deal.value) : "",
      probability: String(deal?.probability ?? STAGE_PROBABILITY[startStage]),
      close_date: deal?.close_date ?? (isClosed(startStage) ? todayISO : ""),
    },
  });
  const { register, handleSubmit, formState, watch, setValue } = form;
  const errors = formState.errors;

  // Start on the first field, also when the form mounts after its lists load.
  useEffect(() => {
    form.setFocus("name");
  }, [form]);

  const orgId = watch("organization_id");
  const chosenStage = watch("stage") as Stage;
  const notes = stageNotes(original, chosenStage);
  const organization = organizations.find((o) => String(o.id) === orgId);
  const choices = contacts.filter((c) => String(c.organization.id) === orgId);
  const noContacts = Boolean(orgId) && choices.length === 0;

  function chooseStage(next: Stage) {
    if (deal && next === deal.stage) {
      // Back to where it started: the deal's own figures, editable again.
      setValue("probability", String(deal.probability));
      setValue("close_date", deal.close_date);
      return;
    }
    setValue("probability", String(STAGE_PROBABILITY[next]));
    if (isClosed(next)) {
      setValue("close_date", todayISO);
    } else if (deal && isClosed(deal.stage)) {
      setValue("close_date", toISODate(addDays(today(), 30)));
    } else if (!deal && isClosed(chosenStage)) {
      setValue("close_date", "");
    } else if (deal) {
      setValue("close_date", deal.close_date);
    }
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
      if (deal && saved.stage !== deal.stage) {
        toast.success(`Moved ${saved.name} to ${STAGE_LABEL[saved.stage]}.`);
      } else {
        toast.success(deal ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
      }
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
        <TextField label="Name" autoComplete="off" {...register("name")} error={errors.name?.message} />
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
        <SelectField
          label="Main contact"
          {...register("main_contact_id")}
          disabled={!orgId || noContacts}
          error={errors.main_contact_id?.message}
          hint={
            noContacts && organization ? (
              <>
                {organization.name} has no contacts yet. Add a contact first.{" "}
                <Link to={`/organizations/${organization.id}?add=contact`} className="link font-medium" onClick={onClose}>
                  Add a contact at {organization.name}
                </Link>
              </>
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
