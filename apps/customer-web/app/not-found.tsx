import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">We can't find that page</h1>
      <p className="mt-2 text-muted">The link may be old. Try the shop instead.</p>
      <Link href="/products" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary">Browse products</Link>
    </div>
  );
}
