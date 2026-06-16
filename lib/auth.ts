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
          throw new Error("メールアドレスの確認が完了していません。受信箱をご確認ください。");
        }

        const isValid = await bcryptjs.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        if (user.accountStatus === "suspended") {
          throw new Error("このアカウントは現在利用停止中です。");
        }

        // 退会済みユーザーがログインした場合は退会を取り消して復活
        if (user.deactivatedAt) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { deactivatedAt: null, scheduledDeletionAt: null },
            });
          } catch {
            // update 失敗してもログイン自体は通す
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image?.startsWith("data:") ? null : user.image,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.picture = user.image?.startsWith("data:") ? null : user.image;
      }
      // クライアントから useSession().update() が呼ばれた時のみ DB を参照
      if (trigger === "update" && token.id && typeof token.id === "string") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, image: true },
          });
          if (dbUser) {
            token.name = dbUser.name;
            token.picture = dbUser.image?.startsWith("data:") ? null : dbUser.image;
          }
        } catch {
          // DB エラー時はトークンをそのまま維持（強制ログアウトしない）
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null;
      }
      return session;
    },
  },
});
