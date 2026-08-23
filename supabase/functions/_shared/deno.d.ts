// Minimal ambient shim so editors/tsc outside the Deno runtime don't choke
// on `Deno.*` and `npm:`/`jsr:` specifiers. Supabase's actual edge runtime
// provides the real Deno global; this file changes nothing at deploy time.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const env: {
    get(key: string): string | undefined;
  };
}

declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
