export default function MiniSessionEmbedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <style>{
        "html, body { min-height: 0 !important; margin: 0; overflow: hidden !important; overscroll-behavior: none; background: transparent !important; }"
      }</style>
      {children}
    </>
  );
}
