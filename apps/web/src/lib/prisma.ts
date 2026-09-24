/**
 * Web no longer uses a local Prisma DB — all persistence goes through the Nest API.
 * Kept as a stub so accidental imports fail clearly at runtime without breaking `next build`.
 */
export const prisma = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "Local Prisma is disabled on the web app. Call the Nest API (NEXT_PUBLIC_API_URL) instead.",
      );
    },
  },
) as never;
