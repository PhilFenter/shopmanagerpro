// A shop tool that is one self-contained page in public/<tool>/index.html (Art Prep, ProPlace Prep),
// shown in a frame inside the normal layout. Same idea as Patch Pro (see DECISIONS.md), but these
// tools need nothing from Shop Manager, so there is no bridge: the frame just shows the page.
type ShopToolProps = { src: string; title: string };

export default function ShopTool({ src, title }: ShopToolProps) {
  return (
    <iframe
      src={src}
      title={title}
      className="block w-full rounded-md border-0 bg-background"
      style={{ height: "calc(100dvh - 3rem)" }}
    />
  );
}
