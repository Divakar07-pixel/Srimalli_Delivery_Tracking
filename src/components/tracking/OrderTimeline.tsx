import { Check, Circle, XCircle } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { STATUS_LABEL } from "@/constants/status";
import type { OrderStatus } from "@/types/database";
import type { TrackingTimelineEntry } from "@/types/order";

interface Props {
  currentStatus: OrderStatus;
  history: TrackingTimelineEntry[];
}

const DELIVERY_TIMELINE: OrderStatus[] = [
  "arrived_at_hub",
  "out_for_delivery",
  "delivered",
];

export function OrderTimeline({ currentStatus, history }: Props) {
  if (currentStatus === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-destructive">Order Cancelled</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {history.length ? formatDateTime(history[history.length - 1].changed_at) : ""}
          </p>
        </div>
      </div>
    );
  }

  const currentIndex = DELIVERY_TIMELINE.indexOf(currentStatus);
  const timestampFor = (status: OrderStatus) => history.find((h) => h.new_status === status)?.changed_at;
  const effectiveIndex = currentIndex < 0 ? -1 : currentIndex;

  return (
    <ol className="relative flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between">
      {DELIVERY_TIMELINE.map((status, index) => {
        const isDone = effectiveIndex >= 0 && index <= effectiveIndex;
        const isCurrent = index === effectiveIndex;
        const ts = timestampFor(status);

        return (
          <li key={status} className="relative flex flex-1 gap-3 pb-8 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center">
            {index < DELIVERY_TIMELINE.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-8px)] w-0.5 sm:left-1/2 sm:top-4 sm:h-0.5 sm:w-full",
                  isDone && index < effectiveIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background text-xs font-bold transition-all",
                isDone ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                isCurrent && "ring-4 ring-primary/15"
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
            </span>
            <div className="sm:mt-1">
              <p className={cn("text-sm font-semibold", isDone ? "text-foreground" : "text-muted-foreground")}>
                {STATUS_LABEL[status]}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ts ? formatDateTime(ts) : isCurrent ? "In progress" : "Waiting"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
