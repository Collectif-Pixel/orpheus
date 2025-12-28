#!/usr/bin/env bun
/**
 * Cross-platform build script for Orpheus
 *
 * Usage:
 *   bun run scripts/build.ts          # Build all platforms
 *   bun run scripts/build.ts macos    # Build only macOS
 *   bun run scripts/build.ts linux    # Build only Linux
 *   bun run scripts/build.ts windows  # Build only Windows
 */

import { $ } from "bun";
import { mkdir, rm } from "fs/promises";
import { existsSync } from "fs";

interface BuildTarget {
  name: string;
  target: string;
  platform: "macos" | "linux" | "windows";
}

const targets: BuildTarget[] = [
  { name: "orpheus-macos-arm64", target: "bun-darwin-arm64", platform: "macos" },
  { name: "orpheus-macos-x64", target: "bun-darwin-x64", platform: "macos" },
  { name: "orpheus-linux-x64", target: "bun-linux-x64", platform: "linux" },
  { name: "orpheus-linux-arm64", target: "bun-linux-arm64", platform: "linux" },
  { name: "orpheus-windows-x64.exe", target: "bun-windows-x64-baseline", platform: "windows" },
];

const DIST_DIR = "./dist";
const ENTRY_POINT = "./src/cli/index.ts";

async function clean(): Promise<void> {
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true });
  }
  await mkdir(DIST_DIR, { recursive: true });
}

async function build(target: BuildTarget): Promise<boolean> {
  const outfile = `${DIST_DIR}/${target.name}`;

  console.log(`Building ${target.name}...`);

  try {
    await $`bun build ${ENTRY_POINT} --compile --target=${target.target} --outfile=${outfile}`.quiet();
    console.log(`  ✓ ${target.name}`);
    return true;
  } catch (error) {
    console.error(`  ✗ ${target.name} failed`);
    if (error instanceof Error) {
      console.error(`    ${error.message}`);
    }
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const platformFilter = args[0]?.toLowerCase();

  console.log("\n🎵 Orpheus Cross-Platform Build\n");

  console.log("Cleaning dist directory...");
  await clean();
  console.log("");

  let selectedTargets = targets;
  if (platformFilter && ["macos", "linux", "windows"].includes(platformFilter)) {
    selectedTargets = targets.filter((t) => t.platform === platformFilter);
    console.log(`Building for ${platformFilter} only\n`);
  } else if (platformFilter) {
    console.error(`Unknown platform: ${platformFilter}`);
    console.error("Available: macos, linux, windows");
    process.exit(1);
  }

  const results = await Promise.all(selectedTargets.map(build));

  const successful = results.filter(Boolean).length;
  const failed = results.length - successful;

  console.log("");
  console.log("─".repeat(40));
  console.log(`✓ ${successful} succeeded, ✗ ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log(`\nBinaries available in ${DIST_DIR}/`);
}

main();
