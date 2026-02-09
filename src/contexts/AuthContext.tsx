import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '@/config/msalConfig';
import { api } from '@/lib/api';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployee = useCallback(async () => {
    try {
      const data = await api.get<Employee>('/employees/me');
      setEmployee(data);
    } catch (err) {
      console.error('Error fetching employee:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      fetchEmployee();
    } else {
      setEmployee(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, accounts, fetchEmployee]);

  const signIn = async () => {
    await instance.loginPopup(loginRequest);
  };

  const signOut = async () => {
    await instance.logoutPopup();
    setEmployee(null);
  };

  const role: AppRole = (employee?.role as AppRole) || 'employee';

  return (
    <AuthContext.Provider
      value={{
        employee,
        role,
        isLoading,
        isAdmin: role === 'admin',
        isAuthenticated,
        signIn,
        signOut,
        refreshProfile: fetchEmployee,
      }}
    >
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
