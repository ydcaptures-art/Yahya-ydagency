export function WhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="group fixed right-5 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lift transition hover:scale-105 lg:bottom-8"
    >
      <svg viewBox="0 0 32 32" className="size-7" fill="currentColor" aria-hidden="true">
        <path d="M16.04 3C9.4 3 4 8.33 4 14.9c0 2.3.66 4.45 1.8 6.27L4 29l8.06-1.74a12.2 12.2 0 0 0 3.98.66C22.67 27.92 28 22.6 28 16.02 28 9.44 22.67 3 16.04 3Zm0 22.6c-1.3 0-2.56-.25-3.73-.73l-.27-.11-4.78 1.03 1.05-4.6-.18-.29a9.6 9.6 0 0 1-1.5-5.1c0-5.36 4.38-9.72 9.4-9.72 5.25 0 9.6 4.36 9.6 9.86 0 5.34-4.35 9.66-9.6 9.66Zm5.27-7.22c-.29-.14-1.71-.84-1.98-.94-.26-.1-.46-.14-.65.15-.19.29-.75.94-.92 1.13-.17.19-.34.22-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.76-1.44-1.7-1.6-1.99-.17-.29-.02-.44.12-.59.13-.13.29-.34.43-.5.15-.17.2-.29.29-.48.1-.19.05-.36-.02-.5-.07-.15-.65-1.56-.89-2.14-.23-.56-.47-.48-.65-.49h-.55c-.19 0-.5.07-.77.36-.26.29-1 .98-1 2.4 0 1.4 1.03 2.77 1.17 2.96.15.19 2.03 3.1 4.92 4.34.69.3 1.22.47 1.64.6.69.22 1.32.19 1.82.12.55-.08 1.71-.7 1.95-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.33Z" />
      </svg>
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-full bg-espresso px-3 py-1.5 text-xs text-porcelain opacity-0 transition group-hover:opacity-100 lg:block">
        {label}
      </span>
    </a>
  );
}
