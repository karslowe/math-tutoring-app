import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";

const poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId,
};

let userPool: CognitoUserPool | null = null;

function getUserPool(): CognitoUserPool {
  if (!userPool) {
    userPool = new CognitoUserPool(poolData);
  }
  return userPool;
}

export interface AuthUser {
  username: string;
  email: string;
  name: string;
  sub: string;
  groups: string[];
}

export function getCurrentUser(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const cognitoUser = pool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }
    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        const idToken = session.getIdToken();
        const payload = idToken.decodePayload();
        resolve({
          username: cognitoUser.getUsername(),
          email: payload.email || "",
          name: payload.name || "",
          sub: payload.sub || "",
          groups: payload["cognito:groups"] || [],
        });
      }
    );
  });
}

export function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const cognitoUser = pool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }
    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      }
    );
  });
}

export function getAccessToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const cognitoUser = pool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }
    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(session.getAccessToken().getJwtToken());
      }
    );
  });
}

export function signIn(
  username: string,
  password: string
): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: username, Pool: pool });
    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signUp(
  username: string,
  email: string,
  password: string,
  name: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const attributeList = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({ Name: "name", Value: name }),
    ];

    pool.signUp(username, password, attributeList, [], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function confirmSignUp(
  username: string,
  code: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: username, Pool: pool });
    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function forgotPassword(username: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: username, Pool: pool });
    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function confirmNewPassword(
  username: string,
  code: string,
  newPassword: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: username, Pool: pool });
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  const pool = getUserPool();
  const cognitoUser = pool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
}
