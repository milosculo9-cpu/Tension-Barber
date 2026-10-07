import { cldUrl, TRANSFORMS } from '@/lib/cloudinary'

// Pozadinske slike sa Cloudinary-ja (folder tension-barber/backgrounds).
// Iste slike koriste naslovna strana sajta i admin/berber panel.

// Desktop hero images
export const DESKTOP_HERO_IMAGES = [
  'IMG_8161.jpeg',
  'IMG_4953.jpeg',
  'IMG_3.jpeg',
  'IMG_4951.jpeg',
  'IMG_8168.jpeg',
  'IMG_4958.jpeg',
  'IMG_8166.jpeg',
  'IMG_4955.jpeg',
  'IMG_8169.jpeg',
]

// Mobile hero images (in mobile subfolder)
export const MOBILE_HERO_IMAGES = [
  'mobile/1.jpeg',
  'mobile/2.jpeg',
  'mobile/3.jpeg',
  'mobile/4.jpeg',
  'mobile/5.jpeg',
  'mobile/6.jpeg',
]

const stripExt = (file) => file.replace(/\.[a-z0-9]+$/i, '')

export const getBackgroundImageUrl = (img, transform) =>
  cldUrl(`backgrounds/${stripExt(img)}`,
    transform || (img.startsWith('mobile/') ? TRANSFORMS.backgroundMobile : TRANSFORMS.background))
