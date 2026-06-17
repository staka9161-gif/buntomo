import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcryptjs from "bcryptjs";
import { prisma } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;
        if (!user.passwordHash) return null;

        if (!user.emailVerified) {
          throw new Error(
            "メールアドレスの確認が完了していません。受信箱をご確認ください。"
          );
        }

        const isValid = await bcryptjs.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        if (user.deactivatedAt) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { deactivatedAt: null, scheduledDeletionAt: null },
            });
          } catch {
            // 復元処理に失敗しても、既存仕様どおりログイン処理自体は続行する。
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image?.startsWith("data:") ? null : user.image,
          accountStatus: user.accountStatus === "suspended" ? "suspended" : "active",
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.picture = user.image?.startsWith("data:") ? null : user.image;
        token.accountStatus =
          user.accountStatus === "suspended" ? "suspended" : "active";
      }

      if (token.id && typeof token.id === "string") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { name: true, image: true, accountStatus: true },
          });

          if (dbUser) {
            token.name = dbUser.name;
            token.picture = dbUser.image?.startsWith("data:") ? null : dbUser.image;
            token.accountStatus =
              dbUser.accountStatus === "suspended" ? "suspended" : "active";
          }
        } catch {
          // DBエラー時は既存トークンを維持する。ここで強制ログアウトはしない。
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null;
        session.user.accountStatus =
          token.accountStatus === "suspended" ? "suspended" : "active";
      }

      return session;
    },
  },
});
