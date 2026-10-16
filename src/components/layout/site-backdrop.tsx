/**
 * The page itself: the owner's two framed artworks (parchment with lilies, blush roses) blended
 * into one texture, with their flowers fixed in the corners of the viewport. Built by
 * scripts/build-backgrounds.mjs from assets/source. Decorative only; sits behind everything.
 */
export function SiteBackdrop() {
  const corner = "pointer-events-none absolute select-none";
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-[#f6eae2] [transform:translateZ(0)]">
      <div className="absolute inset-0 bg-[url('/images/backgrounds/site-texture.webp')] bg-cover bg-center" />
      {/* Soft light from the centre keeps long text readable. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(255_250_246/0.55),rgb(255_250_246/0.15)_60%,transparent_85%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/backgrounds/corner-rose-tl.webp" alt="" className={`${corner} start-0 top-0 w-[clamp(84px,11vw,190px)] rtl:-scale-x-100`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/backgrounds/corner-peony-tr.webp" alt="" className={`${corner} end-0 top-0 w-[clamp(120px,18vw,300px)] rtl:-scale-x-100`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/backgrounds/corner-lilies-bl.webp" alt="" className={`${corner} start-0 bottom-0 w-[clamp(110px,15vw,250px)] opacity-85 max-md:opacity-55 rtl:-scale-x-100`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/backgrounds/corner-roses-br.webp" alt="" className={`${corner} end-0 bottom-0 w-[clamp(110px,15vw,240px)] opacity-85 max-md:opacity-55 rtl:-scale-x-100`} />
    </div>
  );
}
