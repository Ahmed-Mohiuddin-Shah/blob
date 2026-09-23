import "@auth/core/types";
import "@auth/core/jwt";

declare module "@auth/core/types" {
  interface Session {
    idToken?: string;
    accessToken?: string;
    error?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      username: string;
      displayName: string;
      role: string;
      accountStatus: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
    userId?: string;
    username?: string;
    displayName?: string;
    role?: string;
    accountStatus?: string;
  }
}
