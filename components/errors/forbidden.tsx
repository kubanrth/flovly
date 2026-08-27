import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconLock } from "@/components/ui/icons";

// 403 — brak uprawnień. Używane w server components zamiast `notFound()`,
// gdy strona istnieje, ale rola użytkownika jej nie widzi (VIEWER →
// ustawienia przestrzeni). 404 w tym miejscu kłamie i wygląda jak błąd aplikacji.
export function Forbidden({
  title = "Brak dostępu",
  description = "Nie masz uprawnień do tego widoku. Skontaktuj się z administratorem przestrzeni.",
  backHref = "/workspaces",
  backLabel = "Wróć do listy",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-12">
      <EmptyState
        icon={IconLock}
        title={title}
        description={description}
        action={
          <Button render={<Link href={backHref} />} variant="secondary" size="md">
            {backLabel}
          </Button>
        }
      />
    </div>
  );
}
