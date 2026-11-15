export interface ResetPasswordCommand {
  token: string;
  password: string;
  /** Checked against `password` and never persisted. */
  confirmPassword: string;
}
