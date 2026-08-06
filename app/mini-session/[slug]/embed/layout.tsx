export default function MiniSessionEmbedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <style>{"html, body { background: transparent !important; }"}</style>
      {children}
    </>
  );
}
