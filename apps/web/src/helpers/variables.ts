import { variablesAvailable } from "@omnichannel/core/domain/value-objects/variable";

type Variable = { name: string; example: string };

export const extractVariable = (text: string) => {
  const variablesOnText = new Set(
    Array.from(text.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/gim)).map(
      (finded) => finded[0]
    )
  );
  return Array.from(variablesOnText.values());
};

export const mountExamples = (text: string, variables: Variable[]) => {
  const variablesOnText = extractVariable(text);
  return variablesOnText.map((variable) => ({
    example: variables.find((v) => v.name === variable)?.example ?? "",
    name: variable,
  }));
};

export const subsVariableOnText = (
  text: string,
  variables: { value: string; name: string }[]
) => {
  for (const variable of variablesAvailable) {
    const value = variables.find((v) => v.name === variable.value)?.value ?? "";
    text = text.replace(new RegExp(variable.value, "gim"), value);
  }
  return text;
};
