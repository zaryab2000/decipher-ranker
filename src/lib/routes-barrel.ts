/**
 * Side-effect barrel: importing this module registers every API route against
 * the shared router instance. The discovery endpoints (openapi.json,
 * .well-known/x402, llms.txt) import this so the generated metadata reflects the
 * complete route registry rather than only the routes Next.js happens to have
 * loaded for the current request.
 */
import "@/app/api/report/origin/route";
import "@/app/api/report/competitive/route";
import "@/app/api/report/merchant/route";
import "@/app/api/categories/route";
import "@/app/api/leaderboard/route";
