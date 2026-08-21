export const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/your-group-invite";
export const WHATSAPP_SUPPORT_NUMBER = "2340000000000";

export function getWhatsAppSupportUrl(message?: string) {
  const text = encodeURIComponent(
    message ?? "Hello Pconnect support, I need help with my voucher account.",
  );
  return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${text}`;
}
