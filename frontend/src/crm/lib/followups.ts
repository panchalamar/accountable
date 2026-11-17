// How late or how soon a follow-up is, from the number of days until it's due.

export type Timing = { text: string; tone: "overdue" | "today" | "soon" };

export function followUpTiming(days: number): Timing {
  if (days < 0) {
    const late = -days;
    return { text: `${late} ${late === 1 ? "day" : "days"} overdue`, tone: "overdue" };
  }
  if (days === 0) return { text: "Due today", tone: "today" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  return { text: `Due in ${days} days`, tone: "soon" };
}
