export const AUTH_ERRORS = {
  CREDENTIALS_REQUIRED: 'Username and password are required',
  NO_SESSION: 'Unauthorized: No active session',
  INVALID_SESSION: 'Unauthorized: Invalid or expired session',
  INVALID_CREDENTIALS: 'Invalid username or password',
  DEACTIVATED: 'Account is deactivated. Please contact your administrator.',
  USER_NOT_FOUND: 'User not found',
  PASSWORD_TOO_SHORT: (minLength: number) => `Password must be at least ${minLength} characters long`,
  PASSWORD_NO_UPPERCASE: 'Password must contain at least one uppercase letter',
  PASSWORD_NO_NUMBER: 'Password must contain at least one number',
  FORBIDDEN: 'Access denied. Role unauthorized.',
} as const;
