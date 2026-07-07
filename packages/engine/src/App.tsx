export function App() {
  const bookSlug = new URLSearchParams(window.location.search).get('book');

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Mappalibro</h1>
      {bookSlug ? (
        <p>
          Book pack <code>{bookSlug}</code> selected. The 3D player arrives in
          Phase 2.
        </p>
      ) : (
        <p>
          No book selected. Open with <code>?book=&lt;slug&gt;</code>.
        </p>
      )}
    </main>
  );
}
