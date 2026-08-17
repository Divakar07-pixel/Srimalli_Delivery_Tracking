import { Check, Circle, XCircle } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { STATUS_LABEL } from "@/constants/status";
import type { OrderStatus } from "@/types/database";
import type { TrackingTimelineEntry } from "@/types/order";

interface Props {
  currentStatus: OrderStatus;
  history: TrackingTimelineEntry[];
}

// The customer/admin delivery timeline intentionally shows only the three
// delivery milestones. Other order statuses remain available to the order
// system and status controls; they are simply not displayed in this timeline.
const DELIVERY_TIMELINE: OrderStatus[] = [
  "arrived_at_hub",
  "out_for_delivery",
  "delivered",
];

export function OrderTimeline({ currentStatus, history }: Props) {
  if (currentStatus === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <XCircle className="h-5 w-5 text-destructive" />
        <div>
          <p className="font-medium text-destructive">Order Cancelled</p>
          <p className="text-sm text-muted-foreground">
            {history.length ? formatDateTime(history[history.length - 1].changed_at) : ""}
          </p>
        </div>
      </div>
    );
  }

  const currentIndex = DELIVERY_TIMELINE.indexOf(currentStatus);
  const timestampFor = (status: OrderStatus) => history.find((h) => h.new_status === status)?.changed_at;

  return (
    <div className="relative">
      <ol className="flex flex-col gap-0 md:flex-row md:items-start md:justify-between md:gap-2">
        {DELIVERY_TIMELINE.map((status, index) => {
          const isComplete = currentIndex >= 0 && (index < currentIndex || (index === currentIndex && currentIndex === DELIVERY_TIMELINE.length - 1));
          const isCurrent = index === currentIndex && !isComplete;
          const isDone = currentIndex >= 0 && index <= currentIndex;
          const ts = timestampFor(status);

          return (
            <li key={status} className="relative flex flex-1 gap-3 pb-8 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center">
              {index < DELIVERY_TIMELINE.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[15px] top-8 h-full w-0.5 md:left-1/2 md:top-4 md:h-0.5 md:w-full md:-translate-x-0",
                    isDone && index < currentIndex ? "bg-primary" : "bg-border"
                  )}
                />
              )}
              <span
                className={cn(
                  "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
                  isCurrent && "ring-4 ring-primary/20"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
              </span>
              <div className="md:mt-1">
                <p className={cn("text-sm font-medium", isDone ? "text-foreground" : "text-muted-foreground")}>
                  {STATUS_LABEL[status]}
                </p>
                <p className="text-xs text-muted-foreground">{ts ? formatDateTime(ts) : isCurrent ? "In progress" : ""}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
