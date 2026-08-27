import { Skeleton } from "@/components/ui/skeleton";

// Szkielet panelu admina — nagłówek, cztery kafle, tabela. Pasek boczny
// i nagłówek marki rysuje layout.
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-52" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-sm" />
    </div>
  );
}
