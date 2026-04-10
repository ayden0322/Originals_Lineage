import { ShopConfigProvider } from '@/components/providers/ShopConfigProvider';

export default function PublicShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShopConfigProvider>{children}</ShopConfigProvider>;
}
