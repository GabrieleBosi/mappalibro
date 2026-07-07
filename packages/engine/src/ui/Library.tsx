import { useEffect, useState } from 'react';

interface BookEntry {
  slug: string;
  title: string;
  author: string;
  year: number;
  summary?: string;
}

/**
 * Home dashboard: lists every book pack from /content/index.json (generated
 * from the packs at build time). Purely data-driven — no slugs in engine code.
 */
export function Library() {
  const [books, setBooks] = useState<BookEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/content/index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { books: BookEntry[] }) => {
        if (!cancelled) setBooks(data.books);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="center-message library">
      <h1>Mappalibro</h1>
      <p className="library-tagline">Walk through the worlds of public-domain books.</p>
      {error && (
        <p>
          Could not load the library: <code>{error}</code>
        </p>
      )}
      {books && books.length === 0 && <p>No books installed yet.</p>}
      {books && books.length > 0 && (
        <nav className="library-grid">
          {books.map((book) => (
            <a key={book.slug} className="library-card" href={`?book=${book.slug}`}>
              <span className="library-card-title">{book.title}</span>
              <span className="library-card-author">
                {book.author} · {book.year}
              </span>
              {book.summary && <span className="library-card-summary">{book.summary}</span>}
              <span className="library-card-cta">Enter the world →</span>
            </a>
          ))}
        </nav>
      )}
    </main>
  );
}
