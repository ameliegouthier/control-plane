import Link from "next/link";

export default function HealthPage() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Control Plane — Health Check</h1>
      <p style={{ color: "green", fontWeight: "bold" }}>App is running.</p>
      <ul>
        <li>NEXT_PUBLIC_SITE_URL: {process.env.NEXT_PUBLIC_SITE_URL ?? "(not set)"}</li>
        <li>DATABASE_URL: {process.env.DATABASE_URL ? "✅ set" : "❌ NOT SET"}</li>
        <li>ENCRYPTION_KEY: {process.env.ENCRYPTION_KEY ? "✅ set" : "❌ NOT SET"}</li>
        <li>NODE_ENV: {process.env.NODE_ENV}</li>
      </ul>
      <p><Link href="/">← Go to Dashboard</Link></p>
    </div>
  );
}
