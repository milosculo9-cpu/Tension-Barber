// Cloudinary: sve slike sajta (berberi, pozadine, logo, lokali) i admin upload.
// Unsigned upload preset ne zahteva nikakav tajni kljuc, pa je bezbedno da stoji u javnom kodu.

export const CLOUDINARY_CLOUD_NAME = 'dqa59xeqg'
export const CLOUDINARY_UPLOAD_PRESET = 'tension_barber'
export const CLOUDINARY_ROOT = 'tension-barber'

const DELIVERY_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`
const UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`

// Standardne transformacije (format i kvalitet automatski, sirina ogranicena, bez uvecavanja)
export const TRANSFORMS = {
  barber: 'f_auto,q_auto,c_fill,g_face,w_600,h_600',
  barberThumb: 'f_auto,q_auto,c_fill,g_face,w_128,h_128',
  background: 'f_auto,q_auto,c_limit,w_1920',
  backgroundMobile: 'f_auto,q_auto,c_limit,w_1080',
  shop: 'f_auto,q_auto,c_limit,w_1200',
  logo: 'f_auto,q_auto,c_limit,w_400',
}

// URL za sliku po public ID-u, npr. cldUrl('barbers/crni', TRANSFORMS.barber)
export const cldUrl = (publicId, transform = 'f_auto,q_auto') =>
  `${DELIVERY_BASE}/${transform}/${CLOUDINARY_ROOT}/${publicId}`

// Ubacuje transformaciju u vec sacuvan Cloudinary URL (iz baze).
// Za URL-ove koji nisu sa Cloudinary-ja vraca ih nepromenjene.
export const optimizeImageUrl = (url, transform = 'f_auto,q_auto') => {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url
  const [head, tail] = url.split('/image/upload/')
  // tail pocinje sa "v123/" (bez transformacije) ili vec ima transformaciju; uklanjamo postojecu
  const parts = tail.split('/')
  const versionIdx = parts.findIndex(p => /^v\d+$/.test(p))
  const rest = versionIdx >= 0 ? parts.slice(versionIdx).join('/') : tail
  return `${head}/image/upload/${transform}/${rest}`
}

// Ime fajla bez dijakritika i specijalnih znakova, npr. "Anđelo" -> "andjelo"
export const slugify = (name) =>
  (name || '')
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/[^a-z0-9]/g, '')

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Upload iz browsera direktno na Cloudinary. Vraca { url, publicId }.
// Public ID dobija vremensku oznaku, jer preset ne dozvoljava prepisivanje postojecih fajlova.
export async function uploadImage(file, { folder = 'barbers', name = 'slika' } = {}) {
  if (!file) throw new Error('Nije izabran fajl')
  if (!file.type?.startsWith('image/')) throw new Error('Dozvoljene su samo slike (JPG, PNG, HEIC...)')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Slika je veća od 10 MB, smanji je pa pokušaj ponovo')

  const publicId = `${CLOUDINARY_ROOT}/${folder}/${slugify(name) || 'slika'}-${Date.now()}`
  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  form.append('public_id', publicId)

  const res = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || 'Upload slike nije uspeo')
  }
  return { url: data.secure_url, publicId: data.public_id }
}
