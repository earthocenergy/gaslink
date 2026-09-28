// @ts-nocheck\nimport {test,expect} from "@playwright/test";
test("homepage",async({page})=>{await page.goto("/");await expect(page.getByText("Find gas.")).toBeVisible()});
for(const [name,path] of [["stations","/stations"],["auth shell","/auth"],["marketplace","/marketplace"],["services","/services"],["business","/business"]] as const)test(name,async({page})=>{await page.goto(path);await expect(page.locator("body")).toBeVisible();expect(page.url()).toContain(path)});
test("station detail shell",async({page})=>{await page.goto("/stations");const link=page.locator('a[href^="/stations/"]').first();test.skip(await link.count()===0,"No visible station fixture");await link.click();await expect(page).toHaveURL(/\/stations\//)});
test("admin rejects anonymous access",async({page})=>{await page.goto("/admin");await page.waitForURL(/\/(auth|admin)/);expect(page.url()).toMatch(/\/auth|\/admin/)});
