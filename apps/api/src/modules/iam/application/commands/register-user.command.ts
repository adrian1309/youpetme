export interface RegisterUserCommand {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  hasSeenWelcome?: boolean;
  correlationId?: string;
}
