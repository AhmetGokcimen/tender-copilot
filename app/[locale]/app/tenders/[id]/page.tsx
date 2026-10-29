import { TenderDetail } from '@/components/TenderDetail';

export default async function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TenderDetail externalId={id} />;
}
