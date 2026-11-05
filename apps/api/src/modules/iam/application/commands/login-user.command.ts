export interface LoginUserCommand {
  email: string;
  password: string;
  correlationId?: string;
}
