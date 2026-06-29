import Link from "next/link";

const navLinks = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
];

export default function Header() {
  return (
    <header className="border-b border-black px-8 py-6">
      <nav className="max-w-4xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-widest uppercase"
        >
          Emil Lavinen
        </Link>
        <ul className="flex gap-8">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-sm tracking-wide hover:opacity-50 transition-opacity"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
