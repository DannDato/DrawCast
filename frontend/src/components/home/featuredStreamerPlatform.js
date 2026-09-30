const PLATFORM_DEFINITIONS = {
    twitch: {
        id: "twitch",
        label: "Twitch",
        icon: "/icons/twitch.svg",
        liveLabel: "EN VIVO EN TWITCH",
        offlineLabel: "FUERA DE LÍNEA",
        visitLabel: "Ver en Twitch",
    },
    kick: {
        id: "kick",
        label: "KICK",
        icon: "/icons/kick.svg",
        liveLabel: "EN VIVO EN KICK",
        offlineLabel: "FUERA DE LÍNEA",
        visitLabel: "Ver en KICK",
    },
    youtube: {
        id: "youtube",
        label: "YouTube",
        icon: "/icons/youtube.svg",
        liveLabel: "EN VIVO EN YOUTUBE",
        offlineLabel: "SIN DIRECTO AHORA",
        visitLabel: "Ver en YouTube",
    },
    tiktok: {
        id: "tiktok",
        label: "TikTok",
        icon: null,
        liveLabel: "EN VIVO EN TIKTOK",
        offlineLabel: "SIN DIRECTO AHORA",
        visitLabel: "Ver en TikTok",
    },
    facebook: {
        id: "facebook",
        label: "Facebook",
        icon: null,
        liveLabel: "EN VIVO EN FACEBOOK",
        offlineLabel: "SIN DIRECTO AHORA",
        visitLabel: "Ver en Facebook",
    },
    x: {
        id: "x",
        label: "X",
        icon: null,
        liveLabel: "EN VIVO EN X",
        offlineLabel: "SIN DIRECTO AHORA",
        visitLabel: "Ver en X",
    },
    web: {
        id: "web",
        label: "Canal",
        icon: null,
        liveLabel: "EN VIVO",
        offlineLabel: "CANAL DE LA COMUNIDAD",
        visitLabel: "Visitar canal",
    },
};

function safeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    try {
        return new URL(
            /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
                ? raw
                : `https://${raw}`,
        );
    } catch {
        return null;
    }
}

export function detectStreamerPlatform(channelUrl) {
    const url = safeUrl(channelUrl);
    if (!url) return { ...PLATFORM_DEFINITIONS.web, slug: "", url: null };

    // Derived from the URL itself: the card does not trust a stored platform label.
    const chunks = url.href.toLowerCase().split("/");
    const host = (chunks[2] || "").replace(/^www\./, "");
    const path = url.pathname.split("/").filter(Boolean);

    let id = "web";
    if (host === "twitch.tv" || host.endsWith(".twitch.tv")) id = "twitch";
    else if (host === "kick.com" || host.endsWith(".kick.com")) id = "kick";
    else if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) id = "youtube";
    else if (host === "tiktok.com" || host.endsWith(".tiktok.com")) id = "tiktok";
    else if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.gg") id = "facebook";
    else if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) id = "x";

    return {
        ...PLATFORM_DEFINITIONS[id],
        slug: String(path[0] || "").replace(/^@/, ""),
        url,
    };
}

export function buildStreamerEmbedUrl(platform, preview) {
    if (preview?.status !== "live" || !platform?.url) return null;

    if (platform.id === "twitch" && platform.slug) {
        const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
        const params = new URLSearchParams({
            channel: platform.slug,
            parent,
            autoplay: "false",
            muted: "true",
        });
        return `https://player.twitch.tv/?${params.toString()}`;
    }

    if (platform.id === "kick" && platform.slug) {
        const params = new URLSearchParams({ autoplay: "false", muted: "true" });
        return `https://player.kick.com/${encodeURIComponent(platform.slug)}?${params.toString()}`;
    }

    if (platform.id === "youtube" && preview?.liveVideoId) {
        const params = new URLSearchParams({ autoplay: "0", mute: "1", playsinline: "1" });
        return `https://www.youtube.com/embed/${encodeURIComponent(preview.liveVideoId)}?${params.toString()}`;
    }

    return null;
}
