"use client";

import { Chip, Typography } from "@mui/material";
import type { ParsedContact } from "./types";

type Props = {
  contacts: ParsedContact[];
  type: "valid" | "invalid" | "empty";
};

export function ContactsPreview({ contacts, type }: Props) {
  if (contacts.length === 0) return null;

  if (type === "valid") {
    return (
      <div className="bg-green-50 rounded-lg p-4">
        <Typography variant="body2" className="font-medium mb-2 text-green-800">
          Contatos válidos para importar:
        </Typography>
        <div className="max-h-40 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-200">
                <th className="text-left p-1">Nome</th>
                <th className="text-left p-1">Telefone Original</th>
                <th className="text-left p-1">Telefone Normalizado</th>
                <th className="text-left p-1">Tags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-b border-green-100">
                  <td className="p-1">{row.name}</td>
                  <td className="p-1 text-gray-500">{row.phone}</td>
                  <td className="p-1 font-mono text-green-700">{row.normalizedPhone}</td>
                  <td className="p-1">{row.tags}</td>
                </tr>
              ))}
              {contacts.length > 5 && (
                <tr>
                  <td colSpan={4} className="p-1 text-gray-500">
                    ... e mais {contacts.length - 5} contatos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === "invalid") {
    return (
      <div className="bg-red-50 rounded-lg p-4">
        <Typography variant="body2" className="font-medium mb-2 text-red-800">
          Contatos com telefone inválido (não serão importados):
        </Typography>
        <div className="max-h-32 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-200">
                <th className="text-left p-1">Nome</th>
                <th className="text-left p-1">Telefone</th>
                <th className="text-left p-1">Problema</th>
              </tr>
            </thead>
            <tbody>
              {contacts.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-b border-red-100">
                  <td className="p-1">{row.name}</td>
                  <td className="p-1 text-red-600">{row.phone}</td>
                  <td className="p-1 text-red-500 text-xs">Formato inválido</td>
                </tr>
              ))}
              {contacts.length > 5 && (
                <tr>
                  <td colSpan={3} className="p-1 text-gray-500">
                    ... e mais {contacts.length - 5} contatos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // type === "empty"
  return (
    <div className="bg-yellow-50 rounded-lg p-4">
      <Typography variant="body2" className="font-medium mb-2 text-yellow-800">
        Contatos sem telefone (não serão importados):
      </Typography>
      <div className="max-h-24 overflow-auto">
        <div className="flex flex-wrap gap-1">
          {contacts.slice(0, 10).map((row, i) => (
            <Chip key={i} label={row.name} size="small" variant="outlined" />
          ))}
          {contacts.length > 10 && (
            <Chip label={`+${contacts.length - 10} mais`} size="small" />
          )}
        </div>
      </div>
    </div>
  );
}
