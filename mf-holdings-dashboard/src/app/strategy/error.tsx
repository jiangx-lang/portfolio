"use client";

import ErrorView from "@/components/ErrorView";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView title="页面加载出错" description={error.message} reset={reset} />;
}
