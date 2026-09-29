/** Export CSV côté navigateur : simple, sans dépendance. */
function escapeCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  // Neutralise les formules pour qu'un tableur n'exécute rien (=, +, -, @).
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.map(escapeCell).join(";"),
    ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
