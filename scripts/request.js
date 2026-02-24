#!/usr/bin/env osascript -l JavaScript

// Alseerr - Request Action
// Submits a media request to Seerr when user selects a search result

ObjC.import("stdlib");

const app = Application.currentApplication();
app.includeStandardAdditions = true;

// ============================================================================
// CONFIGURATION
// ============================================================================

function getEnv(name, defaultValue) {
	try {
		const value = $.getenv(name);
		if (value === undefined || value === null || value === "") {
			return defaultValue !== undefined ? defaultValue : "";
		}
		return value.trim();
	} catch {
		return defaultValue !== undefined ? defaultValue : "";
	}
}

function shellEscape(str) {
	return "'" + str.replace(/'/g, "'\\''") + "'";
}

const CONFIG = {
	seerrUrl: getEnv("seerr_url"),
	apiKey: getEnv("seerr_api_key"),
};

// ============================================================================
// MAIN
// ============================================================================

function run(argv) {
	const seerrUrl = CONFIG.seerrUrl.replace(/\/+$/, "");
	const mediaType = getEnv("mediaType");
	const mediaId = getEnv("mediaId");
	const mediaTitle = getEnv("mediaTitle");
	const mediaStatus = Number.parseInt(getEnv("mediaStatus", "0"), 10);

	// If already available (status 5) or processing (status 3), open in Seerr
	if (mediaStatus >= 3) {
		const webUrl = `${seerrUrl}/${mediaType === "movie" ? "movie" : "tv"}/${mediaId}`;
		return webUrl;
	}

	// If already pending (status 2), notify and open in Seerr
	if (mediaStatus === 2) {
		const webUrl = `${seerrUrl}/${mediaType === "movie" ? "movie" : "tv"}/${mediaId}`;
		return webUrl;
	}

	// Submit request
	const body = JSON.stringify({
		mediaType: mediaType,
		mediaId: Number.parseInt(mediaId, 10),
	});

	try {
		const curlCmd = `curl --silent --location --max-time 10 -X POST -H "X-Api-Key: ${CONFIG.apiKey}" -H "Content-Type: application/json" -d ${shellEscape(body)} -- ${shellEscape(seerrUrl + "/api/v1/request")}`;
		const response = app.doShellScript(curlCmd);
		const data = JSON.parse(response);

		if (data.id) {
			// Success — return the Seerr URL to open in browser
			app.displayNotification(`Requested: ${mediaTitle}`, {
				withTitle: "Alseerr",
				subtitle: `${mediaType === "movie" ? "Movie" : "TV Show"} request submitted`,
			});
		} else if (data.message) {
			app.displayNotification(data.message, {
				withTitle: "Alseerr",
				subtitle: "Request issue",
			});
		}
	} catch (e) {
		app.displayNotification(`Error: ${e.message || e}`, {
			withTitle: "Alseerr",
			subtitle: "Request failed",
		});
	}

	// Return Seerr web URL regardless
	return `${seerrUrl}/${mediaType === "movie" ? "movie" : "tv"}/${mediaId}`;
}
