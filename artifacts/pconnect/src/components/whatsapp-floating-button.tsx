import WhatsAppIcon from "@/components/whatsapp-icon.tsx";
import { useWhatsAppSupportUrl } from "@/lib/site-settings.ts";

export default function WhatsAppFloatingButton() {
  const whatsappSupportUrl = useWhatsAppSupportUrl();

  return (
    <a href={whatsappSupportUrl} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp"
      className="fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-full shadow-[0_0_24px_rgba(37,211,102,0.55)] transition-transform hover:scale-110 md:bottom-6">
      <WhatsAppIcon className="size-14" />
    </a>
  );
}
