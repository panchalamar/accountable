import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from "react";

// Labeled fields with their error messages. The label sits above the field,
// and the error is tied to it with aria-describedby so screen readers read it.

type FieldShellProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
};

function FieldShell({ id, label, error, hint, optional, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-semibold text-ink">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-ink-muted">optional</span> : null}
      </label>
      {children}
      {hint ? (
        <div id={`${id}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] font-medium text-alert-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const INPUT =
  "h-10 w-full rounded-[10px] border border-field-border bg-panel px-3 text-[15px] text-ink placeholder:text-ink-muted " +
  "transition-colors hover:border-ink-muted aria-[invalid=true]:border-alert-strong " +
  "read-only:bg-bg read-only:text-ink disabled:bg-bg disabled:text-ink-muted";

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}

type Common = { label: string; error?: string; hint?: ReactNode; optional?: boolean };

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, optional, id, className = "", ...props }, ref) {
    const fallback = useId();
    const fieldId = id ?? fallback;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} optional={optional}>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, error, hint)}
          className={`${INPUT} ${className}`}
          {...props}
        />
      </FieldShell>
    );
  },
);

export const TextAreaField = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaField({ label, error, hint, optional, id, className = "", ...props }, ref) {
    const fallback = useId();
    const fieldId = id ?? fallback;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} optional={optional}>
        <textarea
          ref={ref}
          id={fieldId}
          rows={4}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, error, hint)}
          className={`${INPUT} h-auto py-2 leading-normal ${className}`}
          {...props}
        />
      </FieldShell>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, Common & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, optional, id, className = "", children, ...props }, ref) {
    const fallback = useId();
    const fieldId = id ?? fallback;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} optional={optional}>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, error, hint)}
          className={`${INPUT} pr-8 ${className}`}
          {...props}
        >
          {children}
        </select>
      </FieldShell>
    );
  },
);
