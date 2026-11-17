import { Pencil, Trash } from "lucide-react";

export function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="inline-flex gap-1">
      <button type="button" className="btn btn-quiet h-8 px-2 text-[13px]" onClick={onEdit} aria-label={`Edit ${name}`}>
        <Pencil size={14} aria-hidden="true" />
        Edit
      </button>
      <button
        type="button"
        className="btn btn-quiet h-8 px-2 text-[13px] text-alert-strong"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
      >
        <Trash size={14} aria-hidden="true" />
        Delete
      </button>
    </div>
  );
}
