import { useEffect } from 'react';
import './styles.css';
import { PlayerView } from './components/PlayerView';
import { useWorldStore } from './state/worldStore';

export function App() {
  const params = new URLSearchParams(window.location.search);
  const bookSlug = params.get('book');
  const locationOverride = params.get('loc');

  const status = useWorldStore((s) => s.status);
  const error = useWorldStore((s) => s.error);
  const loadSpec = useWorldStore((s) => s.loadSpec);

  useEffect(() => {
    if (bookSlug) void loadSpec(bookSlug, { locationOverride });
  }, [bookSlug, locationOverride, loadSpec]);

  if (!bookSlug) {
    return (
      <main className="center-message">
        <h1>Mappalibro</h1>
        <p>
          No book selected. Open with <code>?book=&lt;slug&gt;</code>.
        </p>
      </main>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <main className="center-message">
        <h1>Mappalibro</h1>
        <p>
          Loading <code>{bookSlug}</code>…
        </p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="center-message">
        <h1>Mappalibro</h1>
        <p>
          Could not load <code>{bookSlug}</code>: {error}
        </p>
      </main>
    );
  }

  return <PlayerView />;
}
