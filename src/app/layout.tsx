import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { getFavoriteIds } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { ViewerProvider } from "@/components/ViewerProvider";
import { PageTransitionProvider } from "@/components/motion/PageTransition";
import { SiteNav } from "@/components/nav/SiteNav";
import { Cursor } from "@/components/Cursor";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { default: `${s.photographerName} · ${s.tagline}`, template: `%s · ${s.photographerName}` }, description: s.heroText };
}

// Layout raíz: se renderiza en el servidor, carga quién es el visitante y sus
// favoritos, y los pasa a los proveedores cliente que envuelven toda la app.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const favorites = await getFavoriteIds(user?.id);

  return (
    <html lang="es">
      <body className="font-sans">
        <ViewerProvider
          viewer={user && { id: user.id, name: user.name, role: user.role, canDownload: user.canDownload }}
          initialFavorites={favorites}
        >
          <PageTransitionProvider chrome={<SiteNav brand={settings.photographerName} />}>
            <main>{children}</main>
          </PageTransitionProvider>
          <Cursor />
        </ViewerProvider>
      </body>
    </html>
  );
}
