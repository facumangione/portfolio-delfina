import { getSettings } from "@/lib/settings";
import { PanelTitle } from "@/components/panel/ui";
import { ProfileForm } from "@/components/panel/ProfileForm";
import { TLink } from "@/components/motion/PageTransition";

// La fotógrafa edita su presentación, redes y medios de contacto.
export default async function ProfilePage() {
  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Perfil y contacto">
        <TLink href="/contacto" className="eyebrow hover:text-bone">Ver página de contacto ↗</TLink>
      </PanelTitle>
      <ProfileForm settings={await getSettings()} />
    </>
  );
}
