import { AxiosError } from "axios";

export interface AxiosErrorResponse {
  message?: string;
  error?: {
    error_user_msg?: string;
    message?: string;
  };
}

export function isAxiosError(
  error: unknown
): error is AxiosError<AxiosErrorResponse> {
  return (
    error !== null &&
    typeof error === "object" &&
    "isAxiosError" in error &&
    (error as AxiosError).isAxiosError === true
  );
}

export function getAxiosErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const responseData = error.response?.data;
    if (responseData?.error?.error_user_msg) {
      return responseData.error.error_user_msg;
    }
    if (responseData?.error?.message) {
      return responseData.error.message;
    }
    if (responseData?.message) {
      return responseData.message;
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}
