import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Auto Lab Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
