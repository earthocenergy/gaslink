export type ReleaseMetadata={version:string;release:string;environment:string};
export function getReleaseMetadata():ReleaseMetadata{return{
 version:process.env.npm_package_version??"0.1.0",
 release:process.env.VERCEL_GIT_COMMIT_SHA??process.env.CNGX_RELEASE_SHA??"local",
 environment:process.env.VERCEL_ENV??process.env.NODE_ENV??"development"
};}
