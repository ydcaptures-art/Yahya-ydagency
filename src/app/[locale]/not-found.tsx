import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-lux flex min-h-[70vh] flex-col items-center justify-center pt-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="heading-lg mt-4">Page not found · Sayfa bulunamadı</h1>
      <Link href="/" className="btn-primary mt-8">Home</Link>
    </div>
  );
}
