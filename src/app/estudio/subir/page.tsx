import { PanelTitle } from "@/components/panel/ui";
import { Uploader } from "@/components/panel/Uploader";

export default function UploadPage() {
  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? 2048);
  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Subir fotografías" />
      <Uploader maxMb={maxMb} />
    </>
  );
}
