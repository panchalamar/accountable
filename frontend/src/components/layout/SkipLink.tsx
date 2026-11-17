export function SkipLink({ target = "main" }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      className="absolute left-4 -top-12 z-50 rounded-[10px] bg-ink px-3.5 py-2 font-semibold text-white no-underline focus:top-4"
      onClick={(event) => {
        event.preventDefault();
        const main = document.getElementById(target);
        main?.focus();
        main?.scrollIntoView({ block: "start" });
      }}
    >
      Skip to content
    </a>
  );
}
