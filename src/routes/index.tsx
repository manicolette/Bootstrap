import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { BootstrapApp } from "@/components/bootstrap/BootstrapApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bootstrap — learning phase tracker" },
      { name: "description", content: "A command center for focused, multi-week learning phases and study sessions." },
      { name: "theme-color", content: "#0a0a0f" },
      { property: "og:title", content: "Bootstrap" },
      { property: "og:description", content: "Personal learning phase tracker and session logger." },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", href: "/icon-192.png" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-[var(--color-background)]" />}>
      <BootstrapApp />
    </ClientOnly>
  );
}
