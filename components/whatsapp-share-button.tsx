/** Share sticker page URL into WhatsApp compose (link preview via og tags). */
export function WhatsAppShareButton({ pageUrl }: { pageUrl: string }) {
  const href = `https://wa.me/?text=${encodeURIComponent(pageUrl)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40"
    >
      {/* Brand glyph — Lucide has no WhatsApp icon */}
      <img src="/whatsapp.svg" alt="" className="h-4 w-4" width={16} height={16} />
      WhatsApp
    </a>
  );
}
