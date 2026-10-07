import PanelBackground from '@/components/PanelBackground';

export const metadata = {
  title: 'Tension Barber - Admin Panel',
  description: 'Admin panel za upravljanje terminima i rezervacijama',
};

export default function AdminLayout({ children }) {
  return (
    <>
      <PanelBackground />
      <div className="relative z-10">{children}</div>
    </>
  );
}
