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
  id: 'admin-001',
  user_id: 'admin-001',
  name: 'Administrador',
  email: 'admin@timetrack.com',
  hourly_rate: 0,
  is_active: true,
  supervisor_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
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
