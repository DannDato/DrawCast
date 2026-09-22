export const PUBLIC_FOOTER_LINKS = {
    producto: [
        { label: "Inicio", to: "/" },
        { label: "Crear cuenta", to: "/register" },
        { label: "Iniciar sesión", to: "/login" },
    ],
    ayuda: [
        { label: "FAQ", to: "/faq" },
        { label: "Seguridad", to: "/seguridad" },
    ],
    legal: [
        { label: "Privacidad", to: "/privacidad" },
        { label: "Términos y condiciones", to: "/terminos" },
        { label: "Cookies", to: "/cookies" },
    ],
};

export const APP_FOOTER_LINKS = [
    { label: "FAQ", to: "/faq" },
    { label: "Privacidad", to: "/privacidad" },
    { label: "Términos", to: "/terminos" },
    { label: "Cookies", to: "/cookies" },
    { label: "Seguridad", to: "/seguridad" },
];

export const footerSocialLinks = () => [
    { label: "Instagram", href: import.meta.env.VITE_SOCIAL_INSTAGRAM },
    { label: "YouTube", href: import.meta.env.VITE_SOCIAL_YOUTUBE },
    { label: "Twitch", href: import.meta.env.VITE_SOCIAL_TWITCH },
    { label: "GitHub", href: import.meta.env.VITE_SOCIAL_GITHUB },
].filter((item) => Boolean(item.href));

export const footerSupportEmail = () => String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
