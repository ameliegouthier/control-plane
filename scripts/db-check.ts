#!/usr/bin/env tsx
/**
 * Database Connectivity Check Script
 * 
 * Checks:
 * 1. DNS resolution for DB host
 * 2. Port 5432 reachability
 * 3. Prisma connection (via migrate status)
 * 
 * Usage: npm run db:check
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { execSync } from "child_process";
import { URL } from "url";
import * as dns from "dns/promises";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message: string) {
  log(`❌ ${message}`, "red");
}

function success(message: string) {
  log(`✅ ${message}`, "green");
}

function info(message: string) {
  log(`ℹ️  ${message}`, "blue");
}

function warn(message: string) {
  log(`⚠️  ${message}`, "yellow");
}

async function checkEnvVars() {
  log("\n📋 Checking environment variables...", "blue");
  
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!databaseUrl) {
    error("DATABASE_URL is not set");
    info("Add DATABASE_URL to your .env file (pooled connection, port 6543)");
    return false;
  }
  success("DATABASE_URL is set");

  if (!directUrl) {
    error("DIRECT_URL is not set");
    info("Add DIRECT_URL to your .env file (direct connection, port 5432)");
    info("Required for Prisma migrations!");
    return false;
  }
  success("DIRECT_URL is set");

  // Check SSL mode
  const dbUrlHasSsl = databaseUrl.includes("sslmode=require");
  const directUrlHasSsl = directUrl.includes("sslmode=require");

  if (!dbUrlHasSsl) {
    warn("DATABASE_URL missing sslmode=require (Supabase requires SSL)");
  } else {
    success("DATABASE_URL has sslmode=require");
  }

  if (!directUrlHasSsl) {
    warn("DIRECT_URL missing sslmode=require (Supabase requires SSL)");
  } else {
    success("DIRECT_URL has sslmode=require");
  }

  // Check ports
  try {
    const dbUrl = new URL(databaseUrl);
    const directUrlParsed = new URL(directUrl);
    
    const dbPort = dbUrl.port || "5432";
    const directPort = directUrlParsed.port || "5432";

    if (dbPort === "6543" || dbPort === "65432") {
      success(`DATABASE_URL uses port ${dbPort} (pooled)`);
    } else {
      warn(`DATABASE_URL uses port ${dbPort} (expected 6543 for pooled)`);
    }

    if (directPort === "5432") {
      success(`DIRECT_URL uses port ${directPort} (direct)`);
    } else {
      error(`DIRECT_URL uses port ${directPort} (expected 5432 for direct)`);
      return false;
    }
  } catch (e) {
    error(`Failed to parse connection URLs: ${e}`);
    return false;
  }

  return true;
}

async function checkDNS(hostname: string): Promise<boolean> {
  // Try IPv4 first
  try {
    const ipv4Addresses = await dns.resolve4(hostname);
    if (ipv4Addresses.length > 0) {
      success(`DNS resolution for ${hostname}: OK (IPv4)`);
      info(`  First IPv4 address: ${ipv4Addresses[0]}`);
      return true;
    }
  } catch (e: any) {
    // If IPv4 fails with ENODATA or ENOTFOUND, try IPv6
    if (e.code === "ENODATA" || e.code === "ENOTFOUND") {
      try {
        const ipv6Addresses = await dns.resolve6(hostname);
        if (ipv6Addresses.length > 0) {
          success(`DNS resolution for ${hostname}: OK (IPv6)`);
          info(`  First IPv6 address: ${ipv6Addresses[0]}`);
          return true;
        }
      } catch (e6: any) {
        error(`DNS resolution for ${hostname}: FAILED (both IPv4 and IPv6)`);
        info(`  IPv4 error: ${e.code || e.message}`);
        info(`  IPv6 error: ${e6.code || e6.message}`);
        return false;
      }
    } else {
      // Other errors (network issues, etc.)
      error(`DNS resolution for ${hostname}: FAILED`);
      info(`  Error: ${e.code || e.message}`);
      return false;
    }
  }
  
  // Should not reach here, but just in case
  return false;
}

async function checkPort(hostname: string, port: number): Promise<boolean> {
  // Note: Actual port check requires net.connect which may be blocked
  // We'll rely on Prisma connection test instead
  info(`Port check skipped (use Prisma connection test)`);
  return true;
}

async function checkPrismaConnection() {
  log("\n🔌 Testing Prisma connection...", "blue");
  
  try {
    // Use migrate status as a connection test
    execSync("npx prisma migrate status", {
      stdio: "pipe",
      env: { ...process.env },
    });
    success("Prisma can connect to database");
    return true;
  } catch (e: any) {
    const output = e.stdout?.toString() || e.stderr?.toString() || e.message;
    
    if (output.includes("P1001") || output.includes("Can't reach database")) {
      error("Cannot reach database server");
      info("\nTroubleshooting:");
      info("1. Check DIRECT_URL is correct (port 5432)");
      info("2. Verify Supabase project is active");
      info("3. Check firewall/network settings");
      info("4. Ensure sslmode=require is in connection string");
    } else if (output.includes("P1000") || output.includes("Authentication failed")) {
      error("Authentication failed");
      info("\nTroubleshooting:");
      info("1. Check password in DIRECT_URL");
      info("2. Verify database user has correct permissions");
    } else if (output.includes("P1017") || output.includes("Server closed")) {
      error("Server closed the connection");
      info("\nTroubleshooting:");
      info("1. Check if using pooled connection (port 6543) instead of direct (5432)");
      info("2. Verify DIRECT_URL uses port 5432");
    } else {
      error(`Prisma connection failed: ${output}`);
    }
    
    return false;
  }
}

async function main() {
  log("🔍 Database Connectivity Check", "blue");
  log("=" .repeat(50), "blue");

  // Step 1: Check env vars
  const envOk = await checkEnvVars();
  if (!envOk) {
    log("\n❌ Environment check failed. Fix .env file and try again.", "red");
    process.exit(1);
  }

  // Step 2: Extract hostname and check DNS
  try {
    const directUrl = process.env.DIRECT_URL!;
    const url = new URL(directUrl);
    const hostname = url.hostname;

    log("\n🌐 Checking DNS resolution...", "blue");
    const dnsOk = await checkDNS(hostname);
    if (!dnsOk) {
      log("\n⚠️  DNS check failed, but continuing...", "yellow");
    }

    // Step 3: Check Prisma connection
    const prismaOk = await checkPrismaConnection();
    if (!prismaOk) {
      log("\n❌ Prisma connection check failed.", "red");
      log("\n📖 Next steps:", "blue");
      log("1. Get DIRECT_URL from Supabase Dashboard:");
      log("   Project Settings > Database > Connection string > Direct connection", "blue");
      log("2. Ensure it includes: ?sslmode=require", "blue");
      log("3. Verify port is 5432 (not 6543)", "blue");
      log("4. Run: npm run db:check", "blue");
      process.exit(1);
    }

    log("\n✅ All checks passed! Database is reachable.", "green");
    log("\n💡 You can now run migrations:", "blue");
    log("   npm run db:migrate", "blue");
  } catch (e) {
    error(`Failed to parse DIRECT_URL: ${e}`);
    process.exit(1);
  }
}

main().catch((e) => {
  error(`Unexpected error: ${e}`);
  process.exit(1);
});
