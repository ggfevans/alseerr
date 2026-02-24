#!/usr/bin/env node

// Sync version from package.json to info.plist
// Run automatically via npm's postversion hook

const { readFileSync, writeFileSync } = require("fs");
const { resolve } = require("path");

const root = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = pkg.version;

const plistPath = resolve(root, "info.plist");
let plist = readFileSync(plistPath, "utf8");

// Replace version string in plist
plist = plist.replace(
	/(<key>version<\/key>\s*<string>)[^<]*/,
	`$1${version}`
);

writeFileSync(plistPath, plist, "utf8");
console.log(`Synced version ${version} to info.plist`);
