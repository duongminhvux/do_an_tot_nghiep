import { Injectable } from "@nestjs/common";
import {
  ContentStatus,
  LandingSectionType,
  type Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { SaveLandingDto, UpdateSiteSettingsDto } from "./dto/site.dto";

@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  async publicLanding() {
    const sections = await this.prisma.landingSection.findMany({
      where: { status: ContentStatus.PUBLISHED, enabled: true },
      orderBy: [{ type: "asc" }, { version: "desc" }],
    });
    const newest = new Map<string, (typeof sections)[number]>();
    for (const section of sections)
      if (!newest.has(section.type)) newest.set(section.type, section);
    return [...newest.values()]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((section) => ({
        id: section.id,
        type: section.type,
        enabled: section.enabled,
        orderIndex: section.orderIndex,
        content: {
          title: section.title,
          ...(section.config as Record<string, unknown>),
        },
      }));
  }

  async adminLanding() {
    const sections = await this.prisma.landingSection.findMany({
      orderBy: [{ type: "asc" }, { version: "desc" }],
    });
    const types = [...new Set(sections.map((section) => section.type))];
    return types
      .map((type) => {
        const values = sections.filter((section) => section.type === type);
        const draft = values.find(
          (section) => section.status === ContentStatus.DRAFT,
        );
        const published = values.find(
          (section) => section.status === ContentStatus.PUBLISHED,
        );
        const current = draft ?? published ?? values[0];
        return {
          id: current.id,
          type,
          enabled: current.enabled,
          orderIndex: current.orderIndex,
          draftContent: (draft?.config ?? published?.config ?? {}) as Record<
            string,
            string
          >,
          publishedContent: (published?.config ?? {}) as Record<string, string>,
          updatedAt: current.updatedAt.toISOString(),
          publishedAt: published?.publishedAt?.toISOString(),
        };
      })
      .sort((left, right) => left.orderIndex - right.orderIndex);
  }

  async saveLanding(input: SaveLandingDto) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.sections) {
        const type = item.type as LandingSectionType;
        const draft = await tx.landingSection.findFirst({
          where: { type, status: ContentStatus.DRAFT },
          orderBy: { version: "desc" },
        });
        if (draft) {
          await tx.landingSection.update({
            where: { id: draft.id },
            data: {
              enabled: item.enabled,
              orderIndex: item.orderIndex,
              config: item.draftContent as Prisma.InputJsonValue,
            },
          });
        } else {
          const latest = await tx.landingSection.findFirst({
            where: { type },
            orderBy: { version: "desc" },
          });
          await tx.landingSection.create({
            data: {
              type,
              title: latest?.title ?? type.replaceAll("_", " "),
              enabled: item.enabled,
              orderIndex: item.orderIndex,
              version: (latest?.version ?? 0) + 1,
              config: item.draftContent as Prisma.InputJsonValue,
            },
          });
        }
      }
    });
    return this.adminLanding();
  }

  async publishLanding() {
    await this.prisma.landingSection.updateMany({
      where: { status: ContentStatus.DRAFT },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });
    return this.adminLanding();
  }

  async settings() {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { id: "default" },
    });
    const value =
      setting ?? {
        id: "default",
        siteName: "ListenUp",
        primaryColor: "#2563EB",
        socialLinks: {},
        logoMediaId: null,
        faviconMediaId: null,
      };
    return {
      ...value,
      logoUrl: value.logoMediaId
        ? `/api/v1/media/public/files/${value.logoMediaId}`
        : undefined,
      faviconUrl: value.faviconMediaId
        ? `/api/v1/media/public/files/${value.faviconMediaId}`
        : undefined,
    };
  }

  updateSettings(input: UpdateSiteSettingsDto) {
    return this.prisma.siteSetting.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        siteName: input.siteName ?? "ListenUp",
        primaryColor: input.primaryColor ?? "#2563EB",
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        address: input.address,
        footerText: input.footerText,
        logoMediaId: input.logoMediaId,
        faviconMediaId: input.faviconMediaId,
        socialLinks: (input.socialLinks ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        ...input,
        socialLinks: input.socialLinks as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
