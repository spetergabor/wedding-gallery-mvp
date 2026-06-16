import Image from "next/image";
import { Heart } from "lucide-react";

type FavoriteList = {
  id: string;
  email: string;
  updatedAt: Date;
  items: {
    id: string;
    photo: {
      id: string;
      filename: string;
      thumbnailUrl: string;
    };
  }[];
};

export function FavoriteListsLog({ lists }: { lists: FavoriteList[] }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Kedvenc listák</h2>
          <p className="mt-1 text-sm text-graphite/70">Email címhez mentett képkiválasztások.</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
          <Heart size={18} />
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">Még nincs kedvenc lista</p>
          <p className="mt-1 text-sm text-graphite/70">Ha a pár kedvenceket jelöl, itt fogod látni email szerint.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {lists.map((list) => (
            <div key={list.id} className="rounded-md border border-ink/10 p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <p className="font-medium text-ink">{list.email}</p>
                  <p className="text-sm text-graphite/70">
                    {list.items.length} kedvenc kép · frissítve:{" "}
                    {list.updatedAt.toLocaleString("hu-HU", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>
              </div>

              {list.items.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {list.items.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-md bg-paper p-2">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-mist">
                        <Image src={item.photo.thumbnailUrl} alt={item.photo.filename} fill className="object-cover" sizes="48px" />
                      </div>
                      <p className="truncate text-sm text-graphite">{item.photo.filename}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {list.items.length > 8 ? (
                <p className="mt-3 text-sm text-graphite/70">+{list.items.length - 8} további kedvenc kép</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
