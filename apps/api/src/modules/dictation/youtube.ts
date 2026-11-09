import { gradeDictation as scoreDictation } from '@repo/shared-types/dictation-score';
import { BadRequestException } from '@nestjs/common';
export function youtubeVideoId(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('Dán link YouTube hợp lệ.');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new BadRequestException('Link YouTube không hợp lệ.');
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1);
  if (
    [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'www.youtube-nocookie.com',
    ].includes(host)
  ) {
    id =
      url.pathname === '/watch'
        ? url.searchParams.get('v')
        : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1] ??
          null);
  }
  if (!id || !/^[\w-]{11}$/.test(id))
    throw new BadRequestException(
      'Chỉ hỗ trợ link video YouTube (watch, shorts, embed hoặc youtu.be).',
    );
  return id;
}
export function gradeDictation(expected: string, answer: string) {
  try {
    return scoreDictation(expected, answer);
  } catch (e) {
    throw new BadRequestException(
      e instanceof Error ? e.message : 'Invalid answer.',
    );
  }
}
