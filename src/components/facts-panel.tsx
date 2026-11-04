import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Source, Story } from "@/lib/types";

export function FactsPanel({ story, sources }: { story: Story; sources: Source[] }) {
  if (!story.facts) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Facts are extracted the first time you generate a version.</p>;
  }
  return (
    <div className="space-y-4">
      {story.conflicts.map((conflict) => (
        <Alert key={conflict.description} variant="destructive">
          <AlertTitle>The sources disagree</AlertTitle>
          <AlertDescription>
            {conflict.description} ({conflict.factIds.join(", ")})
          </AlertDescription>
        </Alert>
      ))}
      <ul className="divide-y rounded-lg border bg-card/70 backdrop-blur">
        {story.facts.map((fact) => {
          const outlets = [...new Set(fact.evidence.map((e) => sources.find((s) => s.label === e.source)?.outlet_name))];
          return (
            <li key={fact.id} className="p-3 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline">{fact.id}</Badge>
                <div className="min-w-0">
                  <p>{fact.statement}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fact.attributedTo ? `Attributed to ${fact.attributedTo}. ` : ""}
                    {outlets.join(", ")}
                    {outlets.length === 1 ? " only" : ""}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
