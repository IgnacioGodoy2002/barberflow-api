export type Role = 'ADMIN' | 'BARBER' | 'CLIENT';

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  isDemo?: boolean;
};
