import { Status, StatusValue } from "@omnichannel/core/domain/value-objects/status";
import { Badge } from "./ui/badge";

type Props = {
  status: StatusValue;
};
export const BadgeStatus: React.FC<Props> = (props) => {
  if (!props.status) return <></>;
  const status = Status.create(props.status);
  if (props.status === "budget") {
    return <Badge className="bg-amber-500">{status.formatted}</Badge>;
  }

  if (props.status === "cancelled") {
    return <Badge className="bg-rose-500">{status.formatted}</Badge>;
  }

  if (props.status === "expired") {
    return (
      <Badge className="bg-muted text-muted-foreground">
        {status.formatted}
      </Badge>
    );
  }

  if (props.status === "finished") {
    return <Badge className="bg-green-500">{status.formatted}</Badge>;
  }

  if (props.status === "processing") {
    return <Badge className="bg-orange-500">{status.formatted}</Badge>;
  }

  if (props.status === "order") {
    return <Badge className="bg-primary">{status.formatted}</Badge>;
  }

  if (props.status === "shipped") {
    return <Badge className="bg-teal-500">{status.formatted}</Badge>;
  }

  return <></>;
};
