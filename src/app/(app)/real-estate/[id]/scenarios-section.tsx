"use client";

import * as React from "react";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScenarioDialog } from "./scenario-dialog";
import {
  setCurrentScenarioAction,
  deleteScenarioAction,
} from "../actions";
import { RENTAL_STRATEGY_LABEL } from "@/lib/constants";
import type { RentalScenario } from "@/lib/db/schema";

export function ScenariosSection({
  propertyId,
  scenarios,
  propertyValueEur,
  totalCashInvestedEur,
}: {
  propertyId: string;
  scenarios: RentalScenario[];
  propertyValueEur: number;
  totalCashInvestedEur: number;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-end justify-between">
        <div>
          <CardTitle>Scenarios</CardTitle>
          <CardDescription>
            Plan and compare LTR, STR, and hybrid strategies. Mark one as &ldquo;current&rdquo; to
            anchor your dashboard rollups.
          </CardDescription>
        </div>
        <ScenarioDialog propertyId={propertyId} />
      </CardHeader>
      <CardContent className="p-0">
        {scenarios.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">
            No scenarios yet. Add one to project rental income.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {scenarios.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{s.name}</h4>
                    <Badge variant="muted">{RENTAL_STRATEGY_LABEL[s.strategy as keyof typeof RENTAL_STRATEGY_LABEL]}</Badge>
                    {s.isCurrent ? <Badge variant="accent">Current</Badge> : null}
                  </div>
                  {s.notes ? <p className="text-xs text-text-muted">{s.notes}</p> : null}
                </div>
                <div className="flex items-center gap-1">
                  {!s.isCurrent ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const r = await setCurrentScenarioAction(s.id, propertyId);
                        if (r.ok) toast.success("Marked as current.");
                        else toast.error(r.error);
                      }}
                    >
                      <Star className="size-3.5" /> Set current
                    </Button>
                  ) : null}
                  <ScenarioDialog
                    propertyId={propertyId}
                    scenario={s}
                    trigger={<Button variant="ghost" size="sm">Edit</Button>}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete scenario"
                    onClick={async () => {
                      if (!confirm(`Delete scenario "${s.name}"?`)) return;
                      const r = await deleteScenarioAction(s.id, propertyId);
                      if (r.ok) toast.success("Scenario deleted.");
                      else toast.error(r.error);
                    }}
                  >
                    <Trash2 className="size-4 text-text-muted" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <input type="hidden" data-prop-value={propertyValueEur} data-cash-invested={totalCashInvestedEur} />
      </CardContent>
    </Card>
  );
}
