import { Body, Controller, Get, Post, Put } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../generated/prisma/client";
import { SaveLandingDto, UpdateSiteSettingsDto } from "./dto/site.dto";
import { SiteService } from "./site.service";

@Controller()
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Public()
  @Get("public/landing")
  landing() {
    return this.site.publicLanding();
  }

  @Public()
  @Get("public/site-settings")
  settings() {
    return this.site.settings();
  }

  @Get("admin/landing")
  @Roles(UserRole.ADMIN)
  adminLanding() {
    return this.site.adminLanding();
  }

  @Put("admin/landing")
  @Roles(UserRole.ADMIN)
  save(@Body() input: SaveLandingDto) {
    return this.site.saveLanding(input);
  }

  @Post("admin/landing/publish")
  @Roles(UserRole.ADMIN)
  publish() {
    return this.site.publishLanding();
  }

  @Get("admin/site-settings")
  @Roles(UserRole.ADMIN)
  adminSettings() {
    return this.site.settings();
  }

  @Put("admin/site-settings")
  @Roles(UserRole.ADMIN)
  updateSettings(@Body() input: UpdateSiteSettingsDto) {
    return this.site.updateSettings(input);
  }
}
