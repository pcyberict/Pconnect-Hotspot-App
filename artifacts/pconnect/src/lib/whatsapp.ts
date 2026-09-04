export const DEFAULT_WHATSAPP_SUPPORT_NUMBER = "2340000000000";

export function getWhatsAppSupportUrl(number = DEFAULT_WHATSAPP_SUPPORT_NUMBER, message?: string) {
  const text = encodeURIComponent(
    message ?? "Hello Pconnect support, I need help with my voucher account.",
  );
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${text}`;
}
