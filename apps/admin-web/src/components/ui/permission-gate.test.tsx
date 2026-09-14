import { render,screen } from "@testing-library/react";
import { describe,expect,it } from "vitest";
import { UserRole,UserStatus } from "@listenup/domain";
import { PermissionGate } from "./permission-gate";
import { useAdminSession } from "@/stores/admin-session";
describe("PermissionGate",()=>{it("hides global settings from a teacher",()=>{useAdminSession.setState({user:{id:"teacher-1",fullName:"Teacher",email:"teacher@test",role:UserRole.TEACHER,status:UserStatus.ACTIVE,assignedCourseIds:["course-1"]},token:"teacher"});render(<PermissionGate permission="site-settings:update" fallback={<span>Not allowed</span>}><span>Global settings</span></PermissionGate>);expect(screen.getByText("Not allowed")).toBeInTheDocument();expect(screen.queryByText("Global settings")).not.toBeInTheDocument()})});
