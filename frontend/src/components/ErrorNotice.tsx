import type { ApiError } from "../types/api";
import { getFriendlyErrorMessage } from "../utils/errors";

type ErrorNoticeProps = {
  error: ApiError | null;
};

export function ErrorNotice({ error }: ErrorNoticeProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="error-banner">
      <strong>{error.code}</strong>
      <span>{getFriendlyErrorMessage(error)}</span>
    </div>
  );
}
