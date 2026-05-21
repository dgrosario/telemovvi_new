"use client";
import { changeWorkspace, listWorkspaces } from "@/app/actions/users";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { Check } from "lucide-react";
import { useMemo } from "react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./ui/dropdown-menu";

type Props = {
  workspaces: { id: string; name: string }[];
  workspace: { id: string; name: string };
  onSelected(): void;
};

export const WorkspaceDropdown = (props: Props) => {
  const changeWorkspaceAction = useServerActionMutation(changeWorkspace, {
    onSuccess() {
      window.location.reload();
    },
  });
  const { data } = useServerActionQuery(listWorkspaces, {
    input: undefined,
    queryKey: ["list-workspaces"],
    initialData: {
      workspace: props.workspace,
      workspaces: props.workspaces,
    },
  });

  const workspace = useMemo(() => data?.workspace, [data]);
  const workspaces = useMemo(() => data?.workspaces ?? [], [data]);

  return (
    <DropdownMenuGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          Mudar de área de trabalho
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            {workspaces.map((w) => {
              const isSelected = data.workspace.id === w.id;
              return (
                <DropdownMenuItem
                  className="flex items-center justify-between"
                  key={w.id}
                  onClick={() => {
                    props.onSelected();
                    changeWorkspaceAction.mutate({
                      workspaceId: w.id,
                      pathname: window.location.pathname,
                    });
                  }}
                >
                  <span className="text-xs">{w.name}</span>
                  <Check data-hidden={!isSelected} />
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
};
