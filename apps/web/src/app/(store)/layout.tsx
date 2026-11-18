"use client";

import { SessionProvider, useUser } from "@/components/session-provider";
import { SiteHeader } from "@/components/site-header";

/** Shared by every page that needs a login: loads the session once and renders the header. */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex flex-1 flex-col">
        <HeaderForUser />
        {children}
      </div>
    </SessionProvider>
  );
}

function HeaderForUser() {
  return <SiteHeader user={useUser()} />;
}
