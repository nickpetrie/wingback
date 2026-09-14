# Why a font file is committed here

The shareable team-sheet PNG is rasterised by `sharp` on Vercel, and the first
deployed version came out with every single glyph as a tofu box — while the
DOM text around it on the same page was fine.

The cause is that the SVG asked for `system-ui, sans-serif` by *name*. Locally
that resolves (this repo's dev container has 59 fonts); in the serverless
runtime the image is rendered in, nothing matches, and a missing font does not
raise — it silently draws boxes. That is the same trap `scripts/icons.mjs`
already documents for the app icons, which is why the W in those is drawn as
stroked paths rather than as text.

So the team sheet no longer asks for a font by name. It points `sharp` at this
file by absolute path, which cannot fail to resolve as long as the file ships
with the function — see `outputFileTracingIncludes` in `next.config.ts`.

DejaVu Sans, under the Bitstream Vera licence (see LICENSE-DejaVu.txt), which
permits redistribution provided the notice travels with it.
