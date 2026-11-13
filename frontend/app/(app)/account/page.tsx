import ClientOnly from "@/components/ClientOnly";
import AccountView from "@/components/views/AccountView";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <ClientOnly fallback={<PageSkeleton />}>
      <AccountView />
    </ClientOnly>
  );
}
