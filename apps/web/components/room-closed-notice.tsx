"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DoorClosed } from "lucide-react";
import { arenaSocket } from "@/lib/arena-socket";
import type { FriendRoomClosed } from "@/lib/friendly-arena";
import { useAppSelector } from "@/redux/hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Keep this in the dashboard layout so the notice survives leaving a lobby or match.
export function RoomClosedNotice() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale === "en" ? "en" : "vi";
  const userId = useAppSelector((state) => state.auth.user?._id);
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const lastClosedRoom = useRef<string | null>(null);

  useEffect(() => {
    const closed = (data: FriendRoomClosed) => {
      if (
        !userId ||
        data.reason !== "HOST_LEFT" ||
        data.hostId === userId ||
        data.roomId === lastClosedRoom.current
      )
        return;

      lastClosedRoom.current = data.roomId;
      setOpen(true);
      router.replace(`/${locale}/arena`);
    };
    arenaSocket.on("friend-room:closed", closed);
    return () => {
      arenaSocket.off("friend-room:closed", closed);
    };
  }, [userId, locale, router]);

  return (
    <Dialog open={open && !!userId} onOpenChange={setOpen}>
      <DialogContent closeLabel={t("room_closed.close")}>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <DoorClosed className="size-6" />
        </div>
        <DialogHeader>
          <DialogTitle>{t("room_closed.title")}</DialogTitle>
          <DialogDescription>{t("room_closed.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            {t("room_closed.confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
