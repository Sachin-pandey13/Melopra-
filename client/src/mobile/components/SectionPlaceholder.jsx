export default function SectionPlaceholder({ title }) {
  return (
    <div className="px-4 py-6 border-b border-white/10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 h-24 rounded bg-white/5" />
    </div>
  );
}
