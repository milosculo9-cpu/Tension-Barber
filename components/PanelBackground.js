'use client';

import { useState, useEffect } from 'react';
import { TRANSFORMS } from '@/lib/cloudinary';
import { DESKTOP_HERO_IMAGES, MOBILE_HERO_IMAGES, getBackgroundImageUrl } from '@/lib/backgrounds';

// Pozadina admin i berber panela: iste slike kao na sajtu, smenjuju se, jako zatamljene
// da tekst i termini ostanu citljivi.
const INTERVAL_MS = 7000;

export default function PanelBackground() {
  const [isMobile, setIsMobile] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const onChange = (e) => { setIsMobile(e.matches); setCurrent(0); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const images = isMobile ? MOBILE_HERO_IMAGES : DESKTOP_HERO_IMAGES;
  const transform = isMobile ? TRANSFORMS.panelBackgroundMobile : TRANSFORMS.panelBackground;

  useEffect(() => {
    const timer = setInterval(() => setCurrent(i => (i + 1) % images.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="fixed inset-0 z-0 bg-black pointer-events-none" aria-hidden="true">
      {images.map((img, i) => (
        <div
          key={img}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
          style={{
            backgroundImage: `url(${getBackgroundImageUrl(img, transform)})`,
            opacity: i === current ? 1 : 0,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-black/85" />
    </div>
  );
}
