import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Role } from "@/lib/permissions";

// Ampliamos los tipos de Auth.js para que la sesión lleve id, rol y permiso de descarga.
declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; canDownload: boolean } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" }, // la sesión vive en una cookie firmada (sin tabla de sesiones)
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new CredentialsSignin();
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !user.active) throw new CredentialsSignin();
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) throw new CredentialsSignin();
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    // Se ejecuta cada vez que se lee la sesión. Releemos rol/estado desde la base
    // para que un cambio hecho por el administrador se aplique de inmediato.
    async jwt({ token, user }) {
      const id = (user?.id ?? token.sub) as string | undefined;
      if (!id) return null;
      const dbUser = await db.user.findUnique({
        where: { id },
        select: { role: true, active: true, canDownload: true, name: true },
      });
      if (!dbUser || !dbUser.active) return null; // usuario eliminado o desactivado: se cierra la sesión
      token.sub = id;
      token.name = dbUser.name;
      token.role = dbUser.role;
      token.canDownload = dbUser.canDownload;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as Role;
      session.user.canDownload = Boolean(token.canDownload);
      return session;
    },
  },
});
