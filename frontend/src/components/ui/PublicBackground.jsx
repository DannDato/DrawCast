import DoodleBackground from "./DoodleBackground";

export default function PublicBackground() {
    return (
        <>
            <div className="dc-public-halos" aria-hidden="true" />
            <DoodleBackground className="dc-public-doodle blur-xs" />
            <div className="dc-public-dots" aria-hidden="true" />
        </>
    );
}
