"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border p-8">
      <h1 className="text-xl font-semibold">Unable to load the admin panel</h1>
      <p className="mt-2 text-sm text-muted-foreground">The database may be temporarily unavailable. Please try again.</p>
      <Button type="button" className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}
