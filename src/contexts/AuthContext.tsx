import { createContext, useContext, ReactNode } from 'react';
import { Employee, AppRole } from '@/types';

interface AuthContextType {
  employee: Employee | null;
  role: AppRole;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mockEmployee: Employee = {
  id_employee: 'admin-001',
  employee_name: 'Administrador',
  employee_email: 'admin@timetrack.com',
  home_state: null,
  home_country: null,
  role: 'admin',
  hourly_rate: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextType = {
    employee: mockEmployee,
    role: 'admin',
    isLoading: false,
    isAdmin: true,
    isAuthenticated: true,
    signIn: async () => {},
    signOut: async () => {},
    refreshProfile: async () => {},
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
