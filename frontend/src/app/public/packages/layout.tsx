import { PackageConfigProvider } from '@/components/providers/PackageConfigProvider';

export default function PublicPackagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PackageConfigProvider>{children}</PackageConfigProvider>;
}
