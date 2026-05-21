import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { intervalToDuration } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import CustomChip from "./custom-chip";

type Props = {
  status: Conversation.Status;
  startDate: Date | null;
};

export const ConversationStatusBadge: React.FC<Props> = (props) => {
  const { startDate = new Date() } = props;
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();

      const duration = intervalToDuration({
        start: startDate!,
        end: now,
      });

      const hours = String(duration.hours || 0).padStart(2, "0");
      const minutes = String(duration.minutes || 0).padStart(2, "0");
      const seconds = String(duration.seconds || 0).padStart(2, "0");

      setElapsed([hours, minutes, seconds].join(":"));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startDate]);

  const color = useMemo(
    () =>
      new Map<
        Conversation.Status,
        | "primary"
        | "secondary"
        | "default"
        | "error"
        | "info"
        | "success"
        | "warning"
      >([["waiting", "warning"]]),
    []
  );
  const label = useMemo(
    () => new Map<Conversation.Status, string>([["waiting", elapsed]]),
    [elapsed]
  );

  if (props.status !== "waiting") return <></>;

  return (
    <CustomChip
      size="small"
      slotProps={{
        root: {
          className: "!rounded-full !py-1 !px-[0.2px]",
        },
        label: {
          className: "text-[10px] font-bold",
        },
      }}
      variant="tonal"
      color={color.get(props.status)}
      label={label.get(props.status)}
    />
  );
};
