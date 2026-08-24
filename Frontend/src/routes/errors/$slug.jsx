import { createFileRoute, notFound } from "@tanstack/react-router";
import { ErrorLayout } from "@/components/errors/ErrorLayout";
import { ERROR_PAGES } from "@/components/errors/config";
export const Route = createFileRoute("/errors/$slug")({
  head: ({ params }) => {
    const cfg = ERROR_PAGES[params.slug];
    const title = cfg ? `${cfg.code} — ${cfg.title} · DriveAlert` : "Error · DriveAlert";
    const desc = cfg?.description ?? "An unexpected error occurred.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  loader: ({ params }) => {
    const cfg = ERROR_PAGES[params.slug];
    if (!cfg) throw notFound();
    return { cfg };
  },
  component: ErrorSlugPage,
  notFoundComponent: () => <ErrorLayout config={ERROR_PAGES["404"]} />,
  errorComponent: () => <ErrorLayout config={ERROR_PAGES["500"]} />,
});
function ErrorSlugPage() {
  const { cfg } = Route.useLoaderData();
  return <ErrorLayout config={cfg} />;
}
