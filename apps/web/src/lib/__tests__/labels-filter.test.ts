import { describe, expect, it } from "vitest";
import { filterLabelsByQuery } from "../labels-filter";
import { Label } from "@omnichannel/core/domain/entities/label";

let idCounter = 0;

function label(name: string): Label.Raw {
  idCounter += 1;
  return {
    id: `label-${idCounter}`,
    name,
    color: "#111111",
    workspaceId: "workspace-1",
  };
}

describe("filterLabelsByQuery", () => {
  const labels = [
    label("Urgente"),
    label("Financeiro"),
    label("Pós-venda"),
    label("Comercial"),
  ];

  it("returns all labels when query is empty", () => {
    expect(filterLabelsByQuery(labels, "")).toEqual(labels);
  });

  it("filters labels by name", () => {
    const result = filterLabelsByQuery(labels, "fin");
    expect(result.map((item) => item.name)).toEqual(["Financeiro"]);
  });

  it("ignores case while filtering", () => {
    const result = filterLabelsByQuery(labels, "URGENTE");
    expect(result.map((item) => item.name)).toEqual(["Urgente"]);
  });

  it("ignores accents while filtering", () => {
    const result = filterLabelsByQuery(labels, "pos venda");
    expect(result.map((item) => item.name)).toEqual(["Pós-venda"]);
  });

  it("returns empty array when no labels match", () => {
    expect(filterLabelsByQuery(labels, "inexistente")).toEqual([]);
  });
});
