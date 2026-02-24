const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Since search.js is JXA (not a Node module), we re-implement pure functions
// here for testing. These must stay in sync with scripts/search.js.
// TODO: Extract pure functions into a shared utils.js module.

// ============================================================================
// PURE FUNCTIONS (copied from search.js for testing)
// ============================================================================

function shellEscape(str) {
	return "'" + str.replace(/'/g, "'\\''") + "'";
}

function truncate(text, maxLength) {
	if (!text) return "";
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 1) + "…";
}

function alfredMatcher(str) {
	if (!str) return "";
	const clean = str.replace(/[-()_.:#/\\;,[\]]/g, " ");
	const camelCaseSeparated = str.replace(/([A-Z])/g, " $1");
	return [clean, camelCaseSeparated, str].join(" ");
}

function extractYear(dateStr) {
	if (!dateStr) return "";
	const match = dateStr.match(/^(\d{4})/);
	return match ? match[1] : "";
}

function getMediaStatus(mediaInfo) {
	const MEDIA_STATUS = {
		1: { label: "Unknown", icon: "❓" },
		2: { label: "Pending", icon: "⏳" },
		3: { label: "Processing", icon: "⬇️" },
		4: { label: "Partially Available", icon: "🟡" },
		5: { label: "Available", icon: "✅" },
	};

	if (!mediaInfo || !mediaInfo.status) {
		return { label: "Not Requested", icon: "➕" };
	}
	return MEDIA_STATUS[mediaInfo.status] || { label: "Unknown", icon: "❓" };
}

// ============================================================================
// TESTS
// ============================================================================

describe("shellEscape", () => {
	it("wraps string in single quotes", () => {
		assert.equal(shellEscape("hello"), "'hello'");
	});

	it("escapes embedded single quotes", () => {
		assert.equal(shellEscape("it's"), "'it'\\''s'");
	});

	it("handles empty string", () => {
		assert.equal(shellEscape(""), "''");
	});

	it("handles special characters", () => {
		assert.equal(shellEscape('foo"bar'), "'foo\"bar'");
		assert.equal(shellEscape("foo bar"), "'foo bar'");
		assert.equal(shellEscape("foo;rm -rf /"), "'foo;rm -rf /'");
	});
});

describe("truncate", () => {
	it("returns text unchanged if under limit", () => {
		assert.equal(truncate("hello", 10), "hello");
	});

	it("truncates with ellipsis", () => {
		assert.equal(truncate("hello world", 6), "hello…");
	});

	it("handles null/empty", () => {
		assert.equal(truncate(null, 10), "");
		assert.equal(truncate("", 10), "");
	});

	it("handles exact length", () => {
		assert.equal(truncate("hello", 5), "hello");
	});
});

describe("alfredMatcher", () => {
	it("creates match variants", () => {
		const result = alfredMatcher("Breaking-Bad");
		assert.ok(result.includes("Breaking Bad")); // clean
		assert.ok(result.includes("Breaking-Bad")); // original
	});

	it("handles camelCase", () => {
		const result = alfredMatcher("BreakingBad");
		assert.ok(result.includes(" Breaking Bad")); // separated
	});

	it("handles null/empty", () => {
		assert.equal(alfredMatcher(""), "");
		assert.equal(alfredMatcher(null), "");
	});
});

describe("extractYear", () => {
	it("extracts year from ISO date", () => {
		assert.equal(extractYear("2024-01-15"), "2024");
	});

	it("extracts year from partial date", () => {
		assert.equal(extractYear("2008-01"), "2008");
	});

	it("handles null/empty", () => {
		assert.equal(extractYear(null), "");
		assert.equal(extractYear(""), "");
	});

	it("handles non-date strings", () => {
		assert.equal(extractYear("not-a-date"), "");
	});
});

describe("getMediaStatus", () => {
	it("returns Not Requested for null", () => {
		const result = getMediaStatus(null);
		assert.equal(result.label, "Not Requested");
		assert.equal(result.icon, "➕");
	});

	it("returns Not Requested for missing status", () => {
		const result = getMediaStatus({});
		assert.equal(result.label, "Not Requested");
	});

	it("returns Available for status 5", () => {
		const result = getMediaStatus({ status: 5 });
		assert.equal(result.label, "Available");
		assert.equal(result.icon, "✅");
	});

	it("returns Pending for status 2", () => {
		const result = getMediaStatus({ status: 2 });
		assert.equal(result.label, "Pending");
		assert.equal(result.icon, "⏳");
	});

	it("returns Processing for status 3", () => {
		const result = getMediaStatus({ status: 3 });
		assert.equal(result.label, "Processing");
		assert.equal(result.icon, "⬇️");
	});

	it("handles unknown status codes", () => {
		const result = getMediaStatus({ status: 99 });
		assert.equal(result.label, "Unknown");
	});
});
