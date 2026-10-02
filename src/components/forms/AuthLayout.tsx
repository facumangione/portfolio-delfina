import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";

/** Layout de login/registro: foto a la izquierda, formulario a la derecha. */
export async function AuthLayout({ children }: { children: React.ReactNode }) {
  const photo = await db.photo.findFirst({ where: { published: true, featured: true }, orderBy: { updatedAt: "desc" } });
  return (
    <div className="grid min-h-[100svh] md:grid-cols-2">
      <div className="relative hidden overflow-hidden md:block">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicUrl(photo.displayPath)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink" />
      </div>
      <div className="flex items-center px-6 py-32 md:px-20">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
