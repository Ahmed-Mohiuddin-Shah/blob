export function BlobBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent-pink/10 blur-3xl" />
      <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-accent-orange/10 blur-3xl" />
      <div className="absolute bottom-[-12rem] left-1/3 h-96 w-96 rounded-full bg-metro-pink/10 blur-3xl" />
    </div>
  );
}
