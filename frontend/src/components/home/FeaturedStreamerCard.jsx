import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Radio, Users } from "lucide-react";

import { getFeaturedStreamPreview } from "../../api/channels";
import {
    buildStreamerEmbedUrl,
    detectStreamerPlatform,
} from "./featuredStreamerPlatform";
import "../../styles/featured-streamer.css";

function formatViewers(value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) return null;
    return new Intl.NumberFormat("es-MX", {
        notation: count >= 1000 ? "compact" : "standard",
    }).format(count);
}

function statusCopy(status, loading) {
    if (loading) return "Comprobando disponibilidad del directo";
    if (status === "live") return "Transmitiendo ahora";
    if (status === "offline") return "Ahora mismo no está transmitiendo";
    if (status === "unsupported") return "Vista previa no disponible para esta plataforma";
    return "No pudimos confirmar el estado en vivo";
}

export default function FeaturedStreamerCard({ channel }) {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const mediaRef = useRef(null);
    const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });

    const platform = useMemo(
        () => detectStreamerPlatform(channel?.channelUrl),
        [channel?.channelUrl],
    );

    useEffect(() => {
        let active = true;
        setPreview(null);

        if (!channel?.uuid || !channel?.channelUrl) {
            setLoading(false);
            return () => {
                active = false;
            };
        }

        setLoading(true);
        getFeaturedStreamPreview(channel.uuid, { force: true })
            .then((result) => {
                if (active) setPreview(result?.preview || null);
            })
            .catch(() => {
                if (active) setPreview({ status: "unknown", embeddable: false });
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [channel?.uuid, channel?.channelUrl]);

    useEffect(() => {
        if (!mediaRef.current || typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver(([entry]) => {
            const rect = entry?.contentRect;
            if (rect) setMediaSize({ width: rect.width, height: rect.height });
        });
        observer.observe(mediaRef.current);
        return () => observer.disconnect();
    }, []);

    const embedUrl = buildStreamerEmbedUrl(platform, preview);
    const twitchMeetsMinimum =
        platform.id !== "twitch" ||
        (mediaSize.width >= 400 && mediaSize.height >= 300);
    const canEmbed = Boolean(embedUrl && twitchMeetsMinimum);
    const viewers = formatViewers(preview?.viewerCount);
    const isLive = preview?.status === "live";
    const artworkImage = preview?.thumbnailUrl || null;

    if (!channel) {
        return (
            <article className="dc-featured-streamer is-empty" data-platform="web">
                <div className="dc-featured-streamer-empty">
                    <Radio size={28} />
                    <span>STREAMER RECOMENDADO</span>
                    <strong>Esperando un canal de la comunidad</strong>
                </div>
            </article>
        );
    }

    return (
        <article
            className={`dc-featured-streamer ${isLive ? "is-live" : "is-offline"}`}
            data-platform={platform.id}
        >
            <div className="dc-featured-streamer-media" ref={mediaRef}>
                {canEmbed ? (
                    <iframe
                        className="dc-featured-streamer-embed"
                        src={embedUrl}
                        title={`${channel.name || platform.label} en vivo`}
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <div
                        className="dc-featured-streamer-art"
                        style={
                            artworkImage
                                ? { "--dc-stream-art": `url("${artworkImage}")` }
                                : undefined
                        }
                    >
                        <div className="dc-featured-streamer-art-photo" aria-hidden="true" />
                        <div className="dc-featured-streamer-orbit one" aria-hidden="true" />
                        <div className="dc-featured-streamer-orbit two" aria-hidden="true" />
                        <div className="dc-featured-streamer-grid" aria-hidden="true" />

                        <div className="dc-featured-streamer-brand" aria-hidden="true">
                            {platform.icon ? (
                                <img src={platform.icon} alt="" />
                            ) : (
                                <span>{platform.label.slice(0, 1)}</span>
                            )}
                        </div>

                        <div className="dc-featured-streamer-signal">
                            <span className={isLive ? "is-live" : ""}>
                                {isLive ? platform.liveLabel : platform.offlineLabel}
                            </span>
                            <strong>
                                {preview?.displayName || channel.name || platform.slug || "Canal de la comunidad"}
                            </strong>
                            <small>
                                {statusCopy(preview?.status, loading)}
                            </small>
                        </div>
                    </div>
                )}
            </div>

            <div className="dc-featured-streamer-info">
                <div className="dc-featured-streamer-eyebrow">
                    <span>STREAMER RECOMENDADO</span>
                    <span
                        className={`dc-featured-streamer-status ${isLive ? "is-live" : ""}`}
                    >
                        <i />
                        {loading
                            ? "REVISANDO"
                            : isLive
                              ? "EN VIVO"
                              : platform.label.toUpperCase()}
                    </span>
                </div>

                <div className="dc-featured-streamer-copy">
                    <h3>{preview?.displayName || channel.name || platform.slug || "Descubre un canal"}</h3>
                    <p>{preview?.title || "Un canal de la comunidad TRAZIO."}</p>
                </div>

                {(preview?.category || viewers) && (
                    <div className="dc-featured-streamer-meta">
                        {preview?.category && <span>{preview.category}</span>}
                        {viewers && (
                            <span>
                                <Users size={13} />
                                {viewers}
                            </span>
                        )}
                    </div>
                )}

                {channel.channelUrl && (
                    <a href={channel.channelUrl} target="_blank" rel="noreferrer">
                        {platform.visitLabel}
                        <ExternalLink size={15} />
                    </a>
                )}
            </div>
        </article>
    );
}
