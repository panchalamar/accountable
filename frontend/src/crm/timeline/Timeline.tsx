import { ArrowRight, Mail, Pencil, Phone, Plus, StickyNote, Trash } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { errorMessage } from "../../api/client";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { formatDate, formatWhen } from "../../lib/dates";
import { type Activity, type ActivityType, type TimelineItem, deleteRecord, refreshAfterSave } from "../api";
import { StageChip } from "../components/chips";
import { DoneCheckbox } from "../components/DoneCheckbox";
import { ActivityForm, type LoggedOn } from "../forms/ActivityForm";
import { followUpTiming } from "../lib/followups";
import { daysBetween, today } from "../../lib/dates";

export const TYPE_ICON: Record<ActivityType, typeof Phone> = { call: Phone, email: Mail, note: StickyNote };
export const TYPE_LABEL: Record<ActivityType, string> = { call: "Call", email: "Email", note: "Note" };

type Props = {
  on: LoggedOn;
  items: TimelineItem[] | undefined;
  loading?: boolean;
};

// A record's timeline: its activities, and for a deal its stage changes too,
// newest first. "Log activity" adds one.
export function Timeline({ on, items, loading }: Props) {
  const [logging, setLogging] = useState(false);
  return (
    <section className="panel p-6" aria-labelledby="timeline-h">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="timeline-h" className="text-[17px] font-semibold">
          Timeline
        </h2>
        <button type="button" className="btn btn-primary h-9" onClick={() => setLogging(true)}>
          <Plus size={17} aria-hidden="true" />
          Log activity
        </button>
      </div>
      {loading ? (
        <p className="text-ink-muted">Loading the timeline...</p>
      ) : !items || items.length === 0 ? (
        <p className="text-ink-muted">No activities yet. Log a call, email or note to start the timeline.</p>
      ) : (
        <ol className="flex flex-col">
          {items.map((item) =>
            item.kind === "stage_change" ? (
              <StageChangeEntry key={`s${item.id}`} item={item} />
            ) : (
              <ActivityEntry key={`a${item.id}`} activity={item} on={on} />
            ),
          )}
        </ol>
      )}
      <ActivityForm open={logging} onOpenChange={setLogging} on={on} />
    </section>
  );
}

function StageChangeEntry({ item }: { item: Extract<TimelineItem, { kind: "stage_change" }> }) {
  return (
    <li className="grid grid-cols-[32px_1fr] gap-3 border-t border-divider py-3 first:border-t-0 first:pt-0">
      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-outline-soft text-ink-muted">
        <ArrowRight size={15} aria-hidden="true" />
      </span>
      <div className="pt-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[14.5px]">
          <span className="font-medium">Moved from</span>
          <StageChip stage={item.from_stage} size="sm" />
          <span>to</span>
          <StageChip stage={item.to_stage} size="sm" />
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          <span className="sr-only">Stage change, </span>
          {formatWhen(item.at)}
        </p>
      </div>
    </li>
  );
}

function ActivityEntry({ activity, on }: { activity: Activity; on: LoggedOn }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = TYPE_ICON[activity.type];
  const other = on.kind === "contact" ? activity.deal : activity.contact;
  const otherPath = on.kind === "contact" ? "/deals" : "/contacts";

  async function remove() {
    setBusy(true);
    try {
      await deleteRecord("activity", activity.id);
      setDeleting(false);
      toast.success("Deleted the activity.");
      await refreshAfterSave(queryClient);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const timing = activity.follow_up_date ? followUpTiming(daysBetween(today(), activity.follow_up_date)) : null;

  return (
    <li className="grid grid-cols-[32px_1fr] gap-3 border-t border-divider py-3.5 first:border-t-0 first:pt-0">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-bg text-ink">
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-ink-muted">
              <span className="font-semibold text-ink">{TYPE_LABEL[activity.type]}</span>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              {formatWhen(activity.occurred_at)}
              {other ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, also on </span>
                  <Link to={`${otherPath}/${other.id}`} className="link">
                    {other.name}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="mt-1 whitespace-pre-line text-[14.5px]">{activity.description}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="btn btn-quiet h-8 px-2 text-[13px]"
              onClick={() => setEditing(true)}
              aria-label={`Edit activity: ${activity.description}`}
            >
              <Pencil size={14} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              className="btn btn-quiet h-8 px-2 text-[13px] text-alert-strong"
              onClick={() => setDeleting(true)}
              aria-label={`Delete activity: ${activity.description}`}
            >
              <Trash size={14} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
        {activity.follow_up_date ? (
          <div className="mt-2 flex items-center gap-2.5 rounded-[10px] bg-bg px-3 py-2 text-[13.5px]">
            <DoneCheckbox id={activity.id} done={activity.done} description={activity.description} />
            <span className={activity.done ? "text-ink-muted line-through" : ""}>
              Follow up by <span className="num">{formatDate(activity.follow_up_date)}</span>
            </span>
            {activity.done ? (
              <span className="ml-auto font-medium text-primary-text">Done</span>
            ) : timing ? (
              <span
                className={`ml-auto font-medium ${timing.tone === "overdue" ? "text-alert-strong" : timing.tone === "today" ? "text-secondary-text" : "text-ink-muted"}`}
              >
                {timing.text}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <ActivityForm open={editing} onOpenChange={setEditing} on={on} activity={activity} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this activity?"
        confirmLabel="Delete"
        onConfirm={remove}
        busy={busy}
      >
        <p>{activity.description}</p>
      </ConfirmDialog>
    </li>
  );
}
