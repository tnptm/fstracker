import ClientOnly from "@/components/ClientOnly";
import TrackView from "@/components/views/TrackView";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Track" };

export default function TrackPage() {
  return (
    <ClientOnly fallback={<PageSkeleton />}>
      <TrackView />
    </ClientOnly>
  );
}
