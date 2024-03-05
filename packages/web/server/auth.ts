import NextAuth, { NextAuthOptions, getServerSession } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import AuthentikProvider from "next-auth/providers/authentik";
import serverConfig from "@hoarder/shared/config";
import { validatePassword } from "@hoarder/trpc/auth";
import { db } from "@hoarder/db";
import { DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { Provider } from "next-auth/providers/index";

declare module "next-auth/jwt" {
  export interface JWT {
    user: {
      id: string;
      role: "admin" | "user";
    } & DefaultSession["user"];
  }
}

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  export interface Session {
    user: {
      id: string;
      role: "admin" | "user";
    } & DefaultSession["user"];
  }

  export interface DefaultUser {
    role: "admin" | "user" | null;
  }
}

const providers: Provider[] = [
  CredentialsProvider({
    // The name to display on the sign in form (e.g. "Sign in with...")
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "Email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials) {
        return null;
      }

      try {
        return await validatePassword(
          credentials?.email,
          credentials?.password,
        );
      } catch (e) {
        return null;
      }
    },
  }),
];

if (serverConfig.auth.authentik) {
  providers.push(AuthentikProvider(serverConfig.auth.authentik));
}

export const authOptions: NextAuthOptions = {
  // https://github.com/nextauthjs/next-auth/issues/9493
  adapter: DrizzleAdapter(db) as Adapter,
  providers: providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role || "user",
        };
      }
      return token;
    },
    async session({ session, token }) {
      session.user = { ...token.user };
      return session;
    },
  },
};

export const authHandler = NextAuth(authOptions);

export const getServerAuthSession = () => getServerSession(authOptions);
