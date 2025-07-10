import type { H3Event, EventHandlerRequest } from 'h3';

export function getLocale(event: H3Event<EventHandlerRequest>): string {
    const acceptLanguage = getHeader(event, 'accept-language');
    if (acceptLanguage) {
      // Extract primary locale from accept-language header
      const languages = acceptLanguage.split(',');
      if (languages.length > 0) {
        // Use the first language in the list as the primary locale
        const locale = languages[0]?.split(';');
        if (locale && locale.length > 0) {
          // Trim any whitespace and semicolon from the locale
          const primaryLocale = locale[0]?.trim();
          return primaryLocale || '';
        }
      }
    }
    return '';
}