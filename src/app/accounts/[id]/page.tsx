import AccountDetailClientPage from '@/components/accounts/AccountDetailClientPage';

interface AccountDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;

  return <AccountDetailClientPage accountId={id} />;
}
