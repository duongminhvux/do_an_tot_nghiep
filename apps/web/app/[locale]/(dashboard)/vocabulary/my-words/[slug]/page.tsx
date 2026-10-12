import MyWordsPage from "../page";

export default async function VocabularyFolderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MyWordsPage folderSlug={slug} />;
}
