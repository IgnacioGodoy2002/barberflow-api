import { ConfigService } from '@nestjs/config';

export const DEFAULT_WEB_URL = 'https://barberflow-web-six.vercel.app/';
export const DEFAULT_API_URL = 'https://barberflow-api-9feo.onrender.com';

export function webUrl(config: ConfigService) {
  const url = config.get<string>('WEB_URL') ?? DEFAULT_WEB_URL;
  return url.endsWith('/') ? url : `${url}/`;
}

export function apiUrl(config: ConfigService) {
  return (config.get<string>('API_PUBLIC_URL') ?? DEFAULT_API_URL).replace(
    /\/$/,
    '',
  );
}
