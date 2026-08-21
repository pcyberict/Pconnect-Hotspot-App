import { getWhatsAppSupportUrl } from "@/lib/whatsapp.ts";
import WhatsAppIcon from "@/components/whatsapp-icon.tsx";

export default function WhatsAppFloatingButton() {
  return (
    <a href={getWhatsAppSupportUrl()} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp"
      className="fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-full shadow-[0_0_24px_rgba(37,211,102,0.55)] transition-transform hover:scale-110 md:bottom-6">
      <WhatsAppIcon className="size-14" />
    </a>
  );
}
