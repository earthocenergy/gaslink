export type TelemetryEvent={name:string;properties?:Record<string,string|number|boolean|null>};
export interface ErrorMonitor{capture(error:unknown,context?:Record<string,unknown>):void}
export interface AnalyticsSink{track(event:TelemetryEvent):void}
export const noopErrorMonitor:ErrorMonitor={capture(){}}; export const noopAnalytics:AnalyticsSink={track(){}};
/*
 Integration boundary: adapters may implement Sentry/analytics later.
 Never attach passwords, tokens, cookies, authorization headers, OTP/TOTP,
 private keys, unrestricted form text, or unnecessary precise location.
*/
