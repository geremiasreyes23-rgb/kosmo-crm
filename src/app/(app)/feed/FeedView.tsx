"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { FeedFilters } from "@/components/feed/FeedFilters";
import { FeedPostCard } from "@/components/feed/FeedPostCard";
import { FeedSidebarColumn } from "@/components/feed/FeedSidebarColumn";
import type { FeedAuthorVM, FeedFilter, FeedPageDataVM, FeedSortOrder } from "@/types";

export function FeedView({
  data,
  filter,
  sort,
  currentAuthor,
}: {
  data: FeedPageDataVM;
  filter: FeedFilter;
  sort: FeedSortOrder;
  currentAuthor: FeedAuthorVM;
}) {
  const router = useRouter();

  // Tiempo real — conexión SSE aislada, solo mientras esta página está
  // montada (ver src/lib/feedEvents.ts y app/api/feed/stream/route.ts). No
  // se intenta fusionar el evento en el estado del cliente: simplemente se
  // le pide al servidor los datos de nuevo (router.refresh() no recarga el
  // documento ni pierde el scroll/estado de los componentes cliente), así
  // cada quien ve el Feed con sus propios permisos recalculados.
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const source = new EventSource("/api/feed/stream");
    source.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === "feed-changed") router.refresh();
      } catch {
        // ping/keepalive — ignorar
      }
    };
    return () => source.close();
  }, [router]);

  function navigate(nextFilter: FeedFilter, nextSort: FeedSortOrder) {
    const params = new URLSearchParams();
    if (nextFilter !== "all") params.set("filter", nextFilter);
    if (nextSort !== "recent") params.set("sort", nextSort);
    const qs = params.toString();
    router.push(`/feed${qs ? `?${qs}` : ""}`);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Feed de Actividades"
        description="Mantente al día con las novedades, menciones y actualizaciones de tu equipo."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <FeedComposer currentUser={currentAuthor} users={data.users} onPosted={refresh} />
          <FeedFilters
            filter={filter}
            sort={sort}
            onFilterChange={(f) => navigate(f, sort)}
            onSortChange={(s) => navigate(filter, s)}
          />
          {data.posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-hairline)] p-10 text-center text-sm text-[var(--ink-secondary)]">
              Todavía no hay publicaciones. Sé el primero en compartir algo con tu equipo.
            </div>
          ) : (
            <div className="space-y-4">
              {data.posts.map((post) => (
                <FeedPostCard key={post.id} post={post} users={data.users} onChanged={refresh} />
              ))}
            </div>
          )}
        </div>
        <div className="hidden lg:block">
          <FeedSidebarColumn data={data.sidebar} />
        </div>
      </div>
      <div className="mt-5 lg:hidden">
        <FeedSidebarColumn data={data.sidebar} />
      </div>
    </div>
  );
}
