import { Suspense } from "react";

import BookingArrivalClient from "./BookingArrivalClient";

export default function BookingArrivalPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
          <p className="text-sm text-slate-600">Loading…</p>
        </main>
      }
    >
      <BookingArrivalClient />
    </Suspense>
  );
}
