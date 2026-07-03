export function parseExecuteInput(input) {
  const value = String(input || "").trim();
  const separator = value.indexOf("_");

  if (separator <= 0 || separator === value.length - 1) {
    throw new Error("Usage: meshterm execute <target>_<command>");
  }

  const target = value.slice(0, separator);
  const command = value.slice(separator + 1).trim();

  if (!target || !command) {
    throw new Error("Usage: meshterm execute <target>_<command>");
  }

  return { target, command };
}
