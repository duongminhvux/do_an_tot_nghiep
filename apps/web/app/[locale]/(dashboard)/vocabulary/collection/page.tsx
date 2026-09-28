import { redirect } from 'next/navigation';

export default async function CollectionRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/vocabulary`);
}
