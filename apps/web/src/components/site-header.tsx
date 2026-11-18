"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Store", customerOnly: false },
  // Admins don't place orders, so they have no order history.
  { href: "/orders", label: "My orders", customerOnly: true },
];

export function SiteHeader({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api.logout().catch(() => undefined);
    router.replace("/login");
  }

  // Each item, and the dot before it, can be hidden on small screens.
  const items: { key: string; node: React.ReactNode; hideOnMobile?: boolean }[] = [
    ...links
      .filter((link) => !link.customerOnly || user.role === "CUSTOMER")
      .map(({ href, label }) => ({
        key: href,
        node: (
          <Link
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center hover:text-foreground",
              pathname === href && "text-foreground",
            )}
          >
            {label}
          </Link>
        ),
      })),
    { key: "email", node: <span className="truncate">{user.email}</span>, hideOnMobile: true },
    {
      key: "logout",
      node: (
        <button type="button" onClick={logout} className="inline-flex min-h-10 items-center hover:text-foreground">
          Log out
        </button>
      ),
    },
  ];

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 px-4 py-2 sm:gap-x-4 sm:px-6">
        <Link href="/" className="inline-flex min-h-10 shrink-0 items-center text-base font-bold tracking-tight whitespace-nowrap sm:text-lg">
          Thunder Labs Shop
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground sm:gap-2">
          {items.map(({ key, node, hideOnMobile }, i) => (
            <span key={key} className={cn("flex shrink-0 items-center gap-1.5 sm:gap-2", hideOnMobile && "hidden sm:flex")}>
              {i > 0 && <span aria-hidden>·</span>}
              {node}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
