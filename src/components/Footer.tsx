export default function Footer() {
  return (
    <footer className="flex h-[15px] w-full shrink-0 items-center justify-between overflow-hidden border-t border-zinc-200 bg-zinc-50 px-3 text-[9px] leading-none text-zinc-500">
      <span className="min-w-0 truncate">
        Risk levels shown are indicative and for informational purposes only.
        Verify with official NDRF or state disaster management authorities.
      </span>
      <span className="shrink-0 pl-2">Demo data · NDRF Disaster Risk Map</span>
    </footer>
  );
}
