"use client";

import { SWRConfig } from "swr";
import { ApiError, apiFetch } from "@/lib/api";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (path: string) => apiFetch(path),
        // Keep showing the previous month/year while the next one loads (no layout jump).
        keepPreviousData: true,
        // 4xx errors won't fix themselves; only retry server/network errors.
        onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
          if (err instanceof ApiError && err.status < 500) return;
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), 2000 * 2 ** retryCount);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
