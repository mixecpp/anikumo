export function appUrl(path = "") {
  return `${(process.env.APP_URL ?? "http://localhost:8080").replace(/\/$/, "")}${path}`;
}
