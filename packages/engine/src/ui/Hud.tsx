import { useEffect } from 'react';
import { useWorldStore } from '../state/worldStore';

const BANNER_AUTO_DISMISS_MS = 9000;

export function Hud() {
  const spec = useWorldStore((s) => s.spec);
  const bannerLocationId = useWorldStore((s) => s.bannerLocationId);
  const locationsById = useWorldStore((s) => s.locationsById);
  const dismissBanner = useWorldStore((s) => s.dismissBanner);

  const bannerLocation = bannerLocationId ? locationsById.get(bannerLocationId) : undefined;

  useEffect(() => {
    if (!bannerLocation) return;
    const t = setTimeout(dismissBanner, BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [bannerLocation, dismissBanner]);

  if (!spec) return null;

  return (
    <div className="hud">
      <div className="hud-book">
        <strong>{spec.book.title}</strong>
        <span> · {spec.book.author}</span>
      </div>
      {bannerLocation && (
        <div className="hud-banner" onClick={dismissBanner}>
          <h2>{bannerLocation.name}</h2>
          <p>{bannerLocation.description}</p>
        </div>
      )}
    </div>
  );
}
