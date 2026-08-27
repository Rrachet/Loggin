export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://loggin-amar-proj.vercel.app").replace(/\/$/, "");

export function appUrl(path = "") {
  return `${APP_URL}${path.startsWith("/") ? path : path ? `/${path}` : ""}`;
}
