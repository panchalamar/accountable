import { Search } from "lucide-react";
import { useId } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

export function SearchBox({ value, onChange, label }: Props) {
  const id = useId();
  return (
    <div className="relative w-[300px]">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        size={17}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        autoComplete="off"
        className="h-10 w-full rounded-[10px] border border-field-border bg-panel pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-muted hover:border-ink-muted"
      />
    </div>
  );
}
