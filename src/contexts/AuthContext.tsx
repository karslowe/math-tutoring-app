"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  getCurrentUser,
  getIdToken,
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signOut as cognitoSignOut,
  forgotPassword as cognitoForgotPassword,
  confirmNewPassword as cognitoConfirmNewPassword,
  AuthUser,
} from "@/lib/cognito";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  signOut: () => void;
  forgotPassword: (username: string) => Promise<void>;
  confirmNewPassword: (
    username: string,
    code: string,
    newPassword: string
  ) => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const handleSignIn = useCallback(
    async (username: string, password: string) => {
      await cognitoSignIn(username, password);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    },
    []
  );

  const handleSignUp = useCallback(
    async (username: string, email: string, password: string) => {
      await cognitoSignUp(username, email, password);
    },
    []
  );

  const handleConfirmSignUp = useCallback(
    async (username: string, code: string) => {
      await cognitoConfirmSignUp(username, code);
    },
    []
  );

  const handleSignOut = useCallback(() => {
    cognitoSignOut();
    setUser(null);
  }, []);

  const handleForgotPassword = useCallback(async (username: string) => {
    await cognitoForgotPassword(username);
  }, []);

  const handleConfirmNewPassword = useCallback(
    async (username: string, code: string, newPassword: string) => {
      await cognitoConfirmNewPassword(username, code, newPassword);
    },
    []
  );

  const getToken = useCallback(async () => {
    return getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        confirmSignUp: handleConfirmSignUp,
        signOut: handleSignOut,
        forgotPassword: handleForgotPassword,
        confirmNewPassword: handleConfirmNewPassword,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
