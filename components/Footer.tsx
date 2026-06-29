export default function Footer() {
  return (
    <footer className="border-t border-black px-8 py-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <p className="text-xs tracking-wide text-neutral-400">
          © {new Date().getFullYear()} Emil Lavinen
        </p>
        <p className="text-xs tracking-wide text-neutral-400">
          Helsinki, Finland
        </p>
      </div>
    </footer>
  );
}
