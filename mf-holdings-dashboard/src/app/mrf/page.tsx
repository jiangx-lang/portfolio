"use client";

import dynamic from "next/dynamic";

const MrfPageInner = dynamic(
  () => import("@/components/MrfPageInner").then((m) => m.default),
  { ssr: false }
);

export default function MrfPage() {
  return <MrfPageInner />;
}
