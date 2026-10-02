import { TLink } from "@/components/motion/PageTransition";

export default function NotFound() {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-6">404</p>
      <h1 className="font-display text-6xl font-light md:text-8xl">Fuera de cuadro</h1>
      <p className="mt-6 text-mist">La página que buscás no existe o fue movida.</p>
      <TLink href="/galeria" className="eyebrow mt-10 border-b border-mist pb-1 hover:border-bone hover:text-bone">Volver a la galería</TLink>
    </div>
  );
}
