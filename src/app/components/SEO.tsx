import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

export function SEO({
  title = 'ChatMyte | #1 Omegle Alternative - Best Random Video Chat 2026',
  description = 'Join ChatMyte, the safest and most premium Omegle alternative of 2026. Experience anonymous video chat with strangers, gender filters, and secure 1-on-1 calls instantly.',
  keywords = 'Omegle alternatives 2026, random video chat, sites like Omegle, free video chat with strangers, anonymous video chat, safe stranger chat, chat with random people, cam chat, ChatMyte',
  ogTitle,
  ogDescription,
  ogImage = '/chatmyte_logo.png',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  twitterTitle,
  twitterDescription,
  twitterImage,
}: SEOProps) {
  const siteName = 'ChatMyte';
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={ogTitle || fullTitle} />
      <meta property="og:description" content={ogDescription || description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={twitterTitle || ogTitle || fullTitle} />
      <meta name="twitter:description" content={twitterDescription || ogDescription || description} />
      <meta name="twitter:image" content={twitterImage || ogImage} />
    </Helmet>
  );
}
