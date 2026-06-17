import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountStatus?: "active" | "suspended";
    } & DefaultSession["user"];
  }

  interface User {
    accountStatus?: "active" | "suspended";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accountStatus?: "active" | "suspended";
  }
}
