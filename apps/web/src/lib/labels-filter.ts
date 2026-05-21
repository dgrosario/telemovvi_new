import { Label } from "@omnichannel/core/domain/entities/label";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function filterLabelsByQuery(
  labels: Label.Raw[],
  query: string
): Label.Raw[] {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return labels;
  }

  return labels.filter((label) =>
    normalizeText(label.name).includes(normalizedQuery)
  );
}
