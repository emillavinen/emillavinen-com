export default function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-8 py-16">{children}</div>
  );
}
