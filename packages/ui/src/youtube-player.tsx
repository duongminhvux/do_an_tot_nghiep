"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { sentenceAtTime } from "./dictation-timeline";
type Player = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(t: number, allow: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  setPlaybackRate(n: number): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
};
type Api = {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => Player;
};
type WindowYT = Window & { YT?: Api; onYouTubeIframeAPIReady?: () => void };
function playerError(code: number) {
  if (code === 5)
    return "Trình phát HTML5 không phát được video (mã 5). Thử tải lại hoặc mở trang bằng Chrome/Edge.";
  if (code === 100)
    return "Video đã bị gỡ, đặt riêng tư hoặc không còn truy cập được (mã 100).";
  if (code === 101 || code === 150)
    return `Chủ video không cho phép phát nhúng trên trang này (mã ${code}).`;
  if (code === 153)
    return "YouTube không xác nhận được trang phát video (mã 153). Hãy tải lại trang.";
  if (code === 2) return "Mã video hoặc tham số phát không hợp lệ (mã 2).";
  return `Không phát được video YouTube${code ? ` (mã ${code})` : ""}. Hãy tải lại hoặc kiểm tra video gốc.`;
}
let loading: Promise<Api> | undefined;
function load() {
  const win = window as WindowYT;
  if (win.YT?.Player) return Promise.resolve(win.YT);
  return (loading ??= new Promise<Api>((resolve, reject) => {
    const timer = setTimeout(() => {
      loading = undefined;
      reject(
        new Error(
          "YouTube tải quá lâu. Kiểm tra kết nối và bấm tải lại video.",
        ),
      );
    }, 15000);
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timer);
      if (win.YT) resolve(win.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      loading = undefined;
      reject(new Error("Không tải được trình phát YouTube."));
    };
    document.head.appendChild(script);
  }));
}
export interface YoutubePlayerHandle {
  play(startMs: number, endMs: number): void;
  pause(): void;
}
export const YoutubePlayer = forwardRef<
  YoutubePlayerHandle,
  {
    videoId: string;
    playbackRate?: number;
    onPlayingChange?: (playing: boolean) => void;
    onTimeChange?: (timeMs: number) => void;
    segments?: ReadonlyArray<{ startMs: number; endMs: number }>;
    aspectRatio?: boolean;
  }
>(function YoutubePlayer(
  {
    videoId,
    playbackRate = 1,
    onPlayingChange,
    onTimeChange,
    segments,
    aspectRatio = false,
  },
  ref,
) {
  const holder = useRef<HTMLDivElement>(null),
    player = useRef<Player | null>(null),
    end = useRef<number | null>(null),
    change = useRef(onPlayingChange);
  const position = useRef(onTimeChange),
    requestedSeek = useRef<number | null>(null),
    lastTime = useRef<number | null>(null),
    stopped = useRef<{ time: number; end: number } | null>(null),
    positionEnabled = useRef(false);
  const seekStarted = useRef(0);
  const boundaries = useRef(segments);
  boundaries.current = segments;
  position.current = onTimeChange;
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [retry, setRetry] = useState(0),
    [host, setHost] = useState("https://www.youtube-nocookie.com");
  const fallbackUsed = useRef(false);
  useEffect(() => {
    fallbackUsed.current = false;
    setHost("https://www.youtube-nocookie.com");
  }, [videoId]);
  useEffect(() => {
    change.current = onPlayingChange;
  }, [onPlayingChange]);
  useImperativeHandle(
    ref,
    () => ({
      play(startMs, endMs) {
        const p = player.current;
        if (!p || !ready) {
          setError("Trình phát đang tải. Hãy bấm nghe lại khi video sẵn sàng.");
          return;
        }
        setError("");
        if (p.getPlayerState() === 1 && end.current === endMs / 1000) {
          p.pauseVideo();
          return;
        }
        end.current = endMs / 1000;
        requestedSeek.current = startMs / 1000;
        stopped.current = null;
        positionEnabled.current = true;
        seekStarted.current = Date.now();
        p.seekTo(startMs / 1000, true);
        p.setPlaybackRate(playbackRate);
        p.playVideo();
      },
      pause() {
        end.current = null;
        player.current?.pauseVideo?.();
      },
    }),
    [playbackRate, ready],
  );
  useEffect(() => {
    let disposed = false;
    setReady(false);
    setError("");
    void load()
      .then((api) => {
        if (disposed || !holder.current) return;
        const target = document.createElement("div");
        holder.current.appendChild(target);
        player.current = new api.Player(target, {
          videoId,
          width: "100%",
          height: "300",
          host,
          playerVars: {
            origin: window.location.origin,
            playsinline: 1,
            cc_load_policy: 0,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (!disposed) {
                setReady(true);
                setError("");
              }
            },
            onStateChange: (e: { data: number }) => {
              if (e.data === 1) {
                positionEnabled.current = true;
                stopped.current = null;
              }
              if (!disposed) change.current?.(e.data === 1);
            },
            onError: (event: { data: number }) => {
              if (disposed) return;
              // Retry transport/configuration failures once using YouTube's standard embed.
              // A creator restriction or removed video must remain an explicit error.
              if (
                (event.data === 5 || event.data === 153) &&
                !fallbackUsed.current &&
                host !== "https://www.youtube.com"
              ) {
                fallbackUsed.current = true;
                setHost("https://www.youtube.com");
                setReady(false);
                change.current?.(false);
                return;
              }
              setError(playerError(event.data));
              change.current?.(false);
            },
          },
        });
        if (aspectRatio) {
          const frame = player.current.getIframe();
          frame.style.width = "100%";
          frame.style.height = "100%";
          frame.style.display = "block";
        }
      })
      .catch((e) => {
        if (!disposed) setError(String(e.message));
      });
    const timer = setInterval(() => {
      const p = player.current;
      if (
        !p ||
        typeof p.getCurrentTime !== "function" ||
        typeof p.getPlayerState !== "function"
      )
        return;
      const time = p.getCurrentTime(),
        state = p.getPlayerState();
      let requested = false;
      if (requestedSeek.current !== null) {
        if (
          Math.abs(time - requestedSeek.current) > 0.75 &&
          Date.now() - seekStarted.current < 3000
        )
          return;
        requestedSeek.current = null;
        requested = true;
      }
      if (
        !requested &&
        lastTime.current !== null &&
        Math.abs(time - lastTime.current) > 0.7
      ) {
        end.current = null;
        stopped.current = null;
        positionEnabled.current = true;
      }
      lastTime.current = time;
      if (time > 0.05) positionEnabled.current = true;
      // Also bound playback started with YouTube's own controls, including
      // playback after a manual seek. Keep the selected sentence when it stops.
      if (state === 1 && end.current === null && !stopped.current) {
        const sentences = boundaries.current;
        if (sentences?.length) {
          const index = sentenceAtTime(sentences, Math.round(time * 1000));
          const sentence = sentences[index];
          if (sentence && sentence.endMs > sentence.startMs)
            end.current = sentence.endMs / 1000;
        }
      }
      if (
        p &&
        end.current !== null &&
        p.getPlayerState() === 1 &&
        p.getCurrentTime() >= end.current
      ) {
        p.pauseVideo();
        stopped.current = { time, end: end.current };
        end.current = null;
      }
      const held =
        stopped.current &&
        Math.abs(time - stopped.current.time) < 0.12 &&
        state !== 1
          ? stopped.current.end - 0.001
          : null;
      if (positionEnabled.current)
        position.current?.(
          Math.round(
            (held ??
              (stopped.current && state === 1
                ? stopped.current.end - 0.001
                : time)) * 1000,
          ),
        );
    }, 80);
    return () => {
      disposed = true;
      clearInterval(timer);
      end.current = null;
      requestedSeek.current = null;
      lastTime.current = null;
      stopped.current = null;
      positionEnabled.current = false;
      player.current?.destroy();
      player.current = null;
    };
  }, [videoId, retry, host, aspectRatio]);
  useEffect(() => {
    if (ready) player.current?.setPlaybackRate(playbackRate);
  }, [playbackRate, ready]);
  return (
    <div>
      {!ready && !error && (
        <p style={{ fontSize: 13, padding: 8 }}>Đang tải video YouTube…</p>
      )}
      <div
        ref={holder}
        style={{
          minHeight: aspectRatio ? 0 : 200,
          width: "100%",
          aspectRatio: aspectRatio ? "16 / 9" : undefined,
        }}
      />
      <a
        href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          fontSize: 13,
          padding: "8px 0",
          color: "#1d4ed8",
        }}
      >
        Mở video trên YouTube ↗
      </a>
      {error && (
        <div
          role="alert"
          style={{ color: "#b91c1c", fontSize: 13, padding: 8 }}
        >
          {error}{" "}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Tải lại video
          </button>
        </div>
      )}
    </div>
  );
});
