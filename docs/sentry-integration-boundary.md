# Sentry integration boundary
Q1 does not create or activate a Sentry account. The code exposes provider-neutral ErrorMonitor/AnalyticsSink interfaces. A future approved adapter may initialize Sentry for Next.js and Expo/React Native with environment + release metadata, source maps and conservative trace sampling.
Privacy gate: never attach passwords, tokens, cookies, authorization headers, OTP/TOTP, private keys, unrestricted form text, or unnecessary precise location. Session Replay requires a separate privacy decision and masking policy.
External decision remaining: approve/create a Sentry organization/project and determine whether free-tier quotas are acceptable. This does not block Q1.
