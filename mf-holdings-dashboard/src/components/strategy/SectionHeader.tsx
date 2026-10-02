"use client";

export function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mb-6">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="font-display mt-2 text-2xl font-bold text-slate-100 sm:text-3xl">
        {title}
      </h2>
      {desc && <p className="mt-2 max-w-3xl text-sm text-slate-400">{desc}</p>}
    </div>
  );
}
