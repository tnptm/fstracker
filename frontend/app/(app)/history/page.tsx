import ClientOnly from "@/components/ClientOnly";
import HistoryView from "@/components/views/HistoryView";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <ClientOnly fallback={<PageSkeleton />}>
      <HistoryView />
    </ClientOnly>
  );
}
