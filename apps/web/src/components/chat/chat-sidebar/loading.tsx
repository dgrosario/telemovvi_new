import { SidebarGroupContent } from "@/components/ui/sidebar";
import { Skeleton } from "@mui/material";

type Props = {
  isLoading?: boolean;
};

export const Loading: React.FC<Props> = (props) => (
  <SidebarGroupContent data-hidden={!props.isLoading} className="gap-1 grid">
    <Skeleton variant="rectangular" width="100%" height={99} />
    <Skeleton variant="rectangular" width="100%" height={99} />
    <Skeleton variant="rectangular" width="100%" height={99} />
    <Skeleton variant="rectangular" width="100%" height={99} />
    <Skeleton variant="rectangular" width="100%" height={99} />
  </SidebarGroupContent>
);
