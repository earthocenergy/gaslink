import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
export const metadata={title:APP_NAME+" | "+APP_TAGLINE,description:APP_TAGLINE,viewport:"width=device-width, initial-scale=1, viewport-fit=cover",themeColor:"#0b1915"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}