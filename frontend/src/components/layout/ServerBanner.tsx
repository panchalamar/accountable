import { useEffect, useState } from "react";

async function checkHealth(): Promise<boolean> {
  const response = await fetch("/api/health", { cache: "no-store" });
  return response.ok;
}

type Props = {
  check?: () => Promise<boolean>;
  intervalMs?: number;
  /** A slow first start shouldn't flash the message, so it waits for a few failures. */
  failuresBeforeShowing?: number;
};

export function ServerBanner({ check = checkHealth, intervalMs = 3000, failuresBeforeShowing = 3 }: Props) {
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      let ok = false;
      try {
        ok = await check();
      } catch {
        ok = false;
      }
      if (stopped) return;
      setFailures((count) => (ok ? 0 : count + 1));
      timer = setTimeout(run, intervalMs);
    }

    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [check, intervalMs]);

  if (failures < failuresBeforeShowing) return null;

  return (
    <div role="alert" className="bg-alert-strong px-8 py-3 text-[14.5px] font-medium text-white">
      Can't reach Accountable's server. Check that <code className="font-mono">npm run dev</code> is still
      running.
    </div>
  );
}
