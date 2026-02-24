#!/usr/bin/env osascript -l JavaScript

// Alseerr - Request Action
// Submits a media request to Seerr when user presses Alt+Enter

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

	// Parse the request payload from arg (passed via alt modifier)
	let payload;
	try {
		payload = JSON.parse(argv[0]);
	} catch (e) {
		app.displayNotification("Invalid request data", {
			withTitle: "Alseerr",
			subtitle: "Request failed",
		});
		return "";
	}

	const mediaType = payload.mediaType;
	const mediaId = payload.mediaId;
	const mediaTitle = payload.mediaTitle || "Unknown";
	const mediaStatus = payload.mediaStatus || 0;
	const webUrl = `${seerrUrl}/${mediaType === "movie" ? "movie" : "tv"}/${mediaId}`;

	// If already available or processing, just open in Seerr
	if (mediaStatus >= 3) {
		app.displayNotification(`${mediaTitle} is already ${mediaStatus === 5 ? "available" : "processing"}`, {
			withTitle: "Alseerr",
			subtitle: "No request needed",
		});
		return webUrl;
	}

	// If already pending, notify
	if (mediaStatus === 2) {
		app.displayNotification(`${mediaTitle} is already pending approval`, {
			withTitle: "Alseerr",
			subtitle: "Request already submitted",
		});
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

	// Return Seerr web URL to open after request
	return webUrl;
}
