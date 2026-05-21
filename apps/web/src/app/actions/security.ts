"use server";
import { BcryptPasswordDriver } from "@omnichannel/core/infra/drivers/password-driver";
import { JWTTokenDriver } from "@omnichannel/core/infra/drivers/token-driver";
import { cookies } from "next/headers";
import { createServerAction } from "zsa";
import { COOKIE_TOKEN_NAME, COOKIE_WORKSPACE_NAME } from "../constants";
import { UsersDatabaseRepository } from "@omnichannel/core/infra/repositories/users-repository";

export async function checkPassword(password: string, encrypted: string) {
  return BcryptPasswordDriver.instance().compare(password, encrypted);
}

export async function getUserAuthenticateId() {
  const cookieStore = await cookies();

  const token = cookieStore.get(COOKIE_TOKEN_NAME);

  if (!token?.value) return null;

  const userId = JWTTokenDriver.instance().decode(token.value);

  if (!userId) return null;

  return userId;
}

export const getUserAuthenticate = createServerAction().handler(async () => {
  const usersRepository = UsersDatabaseRepository.instance();
  const userId = await getUserAuthenticateId();
  if (!userId) return null;

  const user = await usersRepository.retrieve(userId);

  if (!user) return null;

  return user;
});

export const getWorkspaceSelected = async () => {
  const cookiesStore = await cookies();

  const workspaceId = cookiesStore.get(COOKIE_WORKSPACE_NAME)?.value;

  return workspaceId ?? null;
};
