import { cn } from "@/lib/utils";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/constants/status";
import type { OrderStatus } from "@/types/database";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", STATUS_BADGE_CLASS[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
