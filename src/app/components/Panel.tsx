export default function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <h3 className="mb-5 text-lg font-bold text-slate-900">{title}</h3>
      <div>{children}</div>
    </section>
  );
}