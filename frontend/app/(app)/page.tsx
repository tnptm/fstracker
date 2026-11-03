import ClientOnly from "@/components/ClientOnly";
import HomeView from "@/components/views/HomeView";
import { PageSkeleton } from "@/components/ui";

export default function HomePage() {
  return (
    <ClientOnly fallback={<PageSkeleton />}>
      <HomeView />
    </ClientOnly>
  );
}
