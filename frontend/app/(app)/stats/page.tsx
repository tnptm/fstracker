import ClientOnly from "@/components/ClientOnly";
import StatsView from "@/components/views/StatsView";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Stats" };

export default function StatsPage() {
  return (
    <ClientOnly fallback={<PageSkeleton />}>
      <StatsView />
    </ClientOnly>
  );
}
