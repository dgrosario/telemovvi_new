import {
  getUserAuthenticate,
  getWorkspaceSelected,
} from "@/app/actions/security";
import { redirect, RedirectType } from "next/navigation";

export default async function Page() {
  const [user] = await getUserAuthenticate();
  const workspaceId = await getWorkspaceSelected();
  
  if (!user || !workspaceId) redirect("/signin", RedirectType.replace);

  redirect("/chat", RedirectType.replace);
}
